/**A signalling packet, to be relayed by a signalling server */
export type RTCPacket = {
    from: string,
    to: string,
    type: RTCPacketType,
    body: RTCSessionDescriptionInit | RTCIceCandidate,
};

export type RTCPacketType = "offer" | "answer" | "candidate" |  "error";

/**A function which handles an incoming or outgoing signalling packet */
export type RTCPacketHandler = (packet: RTCPacket) => void;


/**An RTCPeerConnection implementing signalling */
export class SignallingConnection extends RTCPeerConnection {
    public readonly localId: string;
    public readonly peerId: string;

    public readonly onicecandidate: (this: RTCPeerConnection, ev: RTCPeerConnectionIceEvent) => any;
    private readonly sendPacket: RTCPacketHandler;

    /**
     * 
     * @param localId This node's id
     * @param peerId The peer id
     * @param sendPacket A function handling signalling packets by sending them to their destination
     */
    constructor (config: RTCConfiguration, localId: string, peerId: string, sendPacket: RTCPacketHandler) {
        super(config);

        this.localId = localId;
        this.peerId = peerId;
        this.sendPacket = sendPacket;

        this.onicecandidate = ev => this.send("candidate", ev.candidate as RTCIceCandidate);
    }

    /**Be the end to initiate the offer */
    public initiateOffer() : void{
        this.createOffer()
        .then( offer => this.send("offer", offer))
    }

    /**
     * Receives sent signalling packets
     * @param packet A packet send by another `SignallingConnection` 
     */
    public receivePacket(packet: RTCPacket) : void {
        if (packet.to != this.localId || packet.from != this.peerId) return;
        switch (packet.type) {
            case "offer":
                this.setRemoteDescription(new RTCSessionDescription(packet.body as RTCSessionDescriptionInit));
                this.createAnswer()
                .then( answer => this.send("answer", answer) );
                break;
            case "answer":
                this.setRemoteDescription(new RTCSessionDescription(packet.body as RTCSessionDescriptionInit));
                break;
            case "candidate":
                this.addIceCandidate(new RTCIceCandidate(packet.body as RTCIceCandidate));
                break;
            case "error":
                throw new Error("Can't signal to peer");
        }
    }

    private send(type: RTCPacketType,  body: RTCSessionDescriptionInit | RTCIceCandidate) : void {
        let packet: RTCPacket = {from: this.localId, to: this.peerId, type, body};
        this.sendPacket(packet);
    }
}


/**
 * A factory which creates and configures `SignallingConnection` objects' signalling, by passing a `sendPacket` to them and calling `receivePacket`.
 */
export abstract class ConnectionFactory {
    public readonly localId: string;
    public config: RTCConfiguration;

    protected readonly connections: {[id: string]: SignallingConnection};
    protected readonly abstract sendPacket: RTCPacketHandler;

    constructor(config: RTCConfiguration, localId: string) {
        this.config = config;
        this.localId = localId;
    }

    public abstract createConnection(peerId: string) : SignallingConnection;
}

export class WSConnectionFactory extends ConnectionFactory {
    protected readonly sendPacket: RTCPacketHandler = packet => {
        this.socket.send(JSON.stringify(packet));
    };

    private readonly socket: WebSocket;

    constructor (config: RTCConfiguration, localId: string, url: string | URL, protocols?: string | string[]) {
        super(config, localId);
        
        this.socket = new WebSocket(url, protocols);

        this.socket.onmessage = ev => {
            let packet: RTCPacket = JSON.parse(ev.data);
            if (packet.to != this.localId) return;
            let connection = this.connections[packet.from];
            if (!connection) return;

            try {
                connection.receivePacket(packet);
            } catch (e) {
                connection.close();
                delete this.connections[packet.from];
            }
        }
    }

    public createConnection(peerId: string): SignallingConnection {
        let connection = new SignallingConnection(this.config, this.localId, peerId, this.sendPacket);;
        this.connections[peerId] = connection;
        return connection;
    }
    
    
}