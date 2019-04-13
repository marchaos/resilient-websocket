export interface OnCallback {
    (arg: any): void;
}

export interface ResilientWebSocketOptions {
    autoJsonify?: boolean;
    autoConnect?: boolean;
    reconnectInterval?: number;
    pingEnabled?: boolean;
    pingInterval?: number;
    pongTimeout?: number;
    pingMessage?: string | object;
    pongMessage?: string | object;
}

export const defaultOptions: ResilientWebSocketOptions = {
    autoJsonify: false,
    autoConnect: true,
    reconnectInterval: 1000,
    pingEnabled: false,
    pingInterval: 10000,
    pongTimeout: 5000,
    pingMessage: 'PING',
    pongMessage: 'PONG',
};

export enum WebSocketEvents {
    CONNECTION = 'connection',
    MESSAGE = 'message',
    CONNECTING = 'connecting',
    CLOSE = 'close',
}

export interface WebSocketFactory {
    (url: string): WebSocket;
}

const WebSocketFactory: WebSocketFactory = (url: string) =>
    new WebSocket(url);

class ResilientWebSocket {
    private readonly url: string;
    private readonly options: ResilientWebSocketOptions;
    private readonly callbacks: Map<string, Set<OnCallback>> = new Map();
    private readonly wsFactory: WebSocketFactory;
    private socket!: WebSocket;
    private pongTimeout!: number;
    private pingTimeout!: number;

    constructor(
        url: string,
        options: ResilientWebSocketOptions,
        wsFactory: WebSocketFactory = WebSocketFactory
    ) {
        this.url = url;
        this.options = { ...defaultOptions, ...options };
        this.wsFactory = wsFactory;
        if (this.options.autoConnect) {
            this.socket = this.connect();
        }
    }

    public connect = () => {
        const socket = this.wsFactory(this.url);

        this.respondToCallbacks(WebSocketEvents.CONNECTING, this);
        socket.addEventListener('open', this.onOpen);
        socket.addEventListener('message', this.onMessage);
        socket.addEventListener('close', this.onClose);

        return socket;
    };

    public send = (data: any) => {
        this.socket.send(
            this.options.autoJsonify ? JSON.stringify(data) : data
        );
    };

    public on = (event: string, callback: OnCallback) => {
        let callbackList = this.callbacks.get(event);
        if (!callbackList) {
            callbackList = new Set();
            this.callbacks.set(event, callbackList);
        }
        callbackList.add(callback);
    };

    private respondToCallbacks = (event: WebSocketEvents, data: any) => {
        const callbacks = this.callbacks.get(event);
        if (callbacks) {
            callbacks.forEach(callback => callback(data));
        }
    };

    private onOpen = () => {
        this.respondToCallbacks(WebSocketEvents.CONNECTION, this);

        if (this.options.pingEnabled) {
            this.sendPing();
        }
    };

    private sendPing = () => {
        this.pingTimeout = setTimeout(() => {
            this.send(this.options.pingMessage);
            this.pongTimeout = setTimeout(() => {
                this.pongTimedOut();
            }, this.options.pongTimeout);
        }, this.options.pingInterval);
    };

    private pongTimedOut = () => {
        this.socket.close();
    };

    private pongReceived = () => {
        clearTimeout(this.pongTimeout);
        this.sendPing();
    };

    private onMessage = (event: MessageEvent) => {
        if (
            this.options.pingEnabled &&
            event.data === this.options.pongMessage
        ) {
            return this.pongReceived();
        }

        const message = this.options.autoJsonify
            ? JSON.parse(event.data)
            : event.data;
        this.respondToCallbacks(WebSocketEvents.MESSAGE, message);
    };

    private onClose = (event: CloseEvent) => {
        this.respondToCallbacks(WebSocketEvents.CLOSE, event);
        clearInterval(this.pingTimeout);
        clearTimeout(this.pongTimeout);

        setTimeout(() => {
            this.socket = this.connect();
        }, this.options.reconnectInterval);
    };
}

export default ResilientWebSocket;
