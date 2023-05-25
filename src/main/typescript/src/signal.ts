export type SignallingPortId = string;

interface Signal {
    data: any;
}
export interface IncomingSignal extends Signal {
    from: SignallingPortId;
}
export interface OutgoingSignal extends Signal {
    to: SignallingPortId;
}



interface SignallingChannelEventMap {
    open: Event;
    error: Event
    signal: IncomingSignalEvent;
    close: CloseEvent;
}

export abstract class SignallingChannel extends EventTarget {
    onopen: (ev: Event) => any | null;
    onerror: (ev: Event) => any | null;
    onsignal: (ev: IncomingSignalEvent) => any | null;
    onclose: (ev: CloseEvent) => any | null;

    abstract signal(signal: OutgoingSignal): void;
    abstract close(): void;

    port(to: SignallingPortId): SignallingPort {
        return new SignallingPort(this, to);
    }

    addEventListener<K extends keyof SignallingChannelEventMap>(
        type: K,
        callback: (ev: SignallingChannelEventMap[K]) => any,
        options?: boolean | AddEventListenerOptions
    ): void;
    addEventListener(
        type: string,
        callback: EventListenerOrEventListenerObject | null,
        options?: boolean | AddEventListenerOptions | undefined
    ): void {
        super.addEventListener(type, callback, options);
    }

    removeEventListener<K extends keyof SignallingChannelEventMap>(
        type: K,
        callback: (ev: SignallingChannelEventMap[K]) => any,
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

interface IncomingSignalEventInit extends EventInit, IncomingSignal {
}
export class IncomingSignalEvent extends Event implements IncomingSignal {
    readonly from: SignallingPortId;
    readonly data: any;

    constructor (type: string, eventInitDict: IncomingSignalEventInit) {
        super(type, eventInitDict);
        this.from = eventInitDict.from;
        this.data = eventInitDict.data;
    }
}



interface SignallingPortEventMap {
    message: MessageEvent;
    [ev: string]: Event;
}
export class SignallingPort extends EventTarget {
    readonly to: SignallingPortId;

    onmessage: (ev: MessageEvent) => any | null;

    private readonly channel: SignallingChannel;

    constructor(channel: SignallingChannel, to: SignallingPortId) {
        super();
        this.to = to;
        this.channel = channel;

        this.channel.addEventListener("signal", ev => {
            if (ev.from != this.to) return;
            let data = ev.data;
            let event = new MessageEvent("message", {data});
            if (this.onmessage) this.onmessage(event);
            this.dispatchEvent(event);
        });
    }

    send(data: any): void {
        this.channel.signal({to: this.to, data});
    }

    addEventListener<K extends keyof SignallingPortEventMap>(
        type: K,
        callback: (ev: SignallingPortEventMap[K]) => any,
        options?: boolean | AddEventListenerOptions
    ): void;
    addEventListener(
        type: string,
        callback: EventListenerOrEventListenerObject | null,
        options?: boolean | AddEventListenerOptions | undefined
    ): void {
        super.addEventListener(type, callback, options);
    }

    removeEventListener<K extends keyof SignallingPortEventMap>(
        type: K,
        callback: (ev: SignallingPortEventMap[K]) => any,
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



export class WSSignallingChannel extends SignallingChannel {
    private readonly ws: WebSocket;

    constructor(url: string | URL, protocols?: string | string[]) {
        super();
        this.ws = new WebSocket(url, protocols);

        this.ws.addEventListener("open", ev => {
            if (this.onopen) this.onopen(ev);
            this.dispatchEvent(ev);
        });

        this.ws.addEventListener("error", ev => {
            if (this.onerror) this.onerror(ev);
            this.dispatchEvent(ev);
        });

        this.ws.addEventListener ("message", ev => {
        let signal: IncomingSignal;
        if (signal = JSON.parse(ev.data) as IncomingSignal) {
            let event = new IncomingSignalEvent("signal", signal);
            if (this.onsignal) this.onsignal(event);
            this.dispatchEvent(event);
        } 
        });

        this.ws.addEventListener("close", ev => {
            if (this.onclose) this.onclose(ev);
            this.dispatchEvent(ev);
        })
    }

    signal(signal: OutgoingSignal): void {
        this.ws.send(JSON.stringify(signal));
    }
    
    close(): void {
        this.ws.close();
    }
}