import ResilientWebSocket, {
    ResilientWebSocketOptions,
    WebSocketEvent,
    WebSocketFactory,
} from './ResilientWebSocket';

describe('ResilientWebSocket', () => {
    const url = 'ws://localhost';
    let options: ResilientWebSocketOptions;
    let factory: WebSocketFactory;
    let websocketMock: jest.Mocked<WebSocket>;

    beforeEach(() => {
        jest.useFakeTimers();
        options = {};

        websocketMock = {
            addEventListener: jest.fn(),
            removeEventListener: jest.fn(),
            send: jest.fn(),
            close: jest.fn(),
            readyState: WebSocket.CONNECTING,
            url: '',
            protocol: '',
            extensions: '',
            bufferedAmount: 0,
            binaryType: 'blob',
            onopen: null,
            onclose: null,
            onerror: null,
            onmessage: null,
            dispatchEvent: jest.fn(),
            CONNECTING: WebSocket.CONNECTING,
            OPEN: WebSocket.OPEN,
            CLOSING: WebSocket.CLOSING,
            CLOSED: WebSocket.CLOSED
        } as jest.Mocked<WebSocket>;

        factory = jest.fn().mockReturnValue(websocketMock);
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    const createWebSocket = () => new ResilientWebSocket(url, options, factory);

    it('factory passed url', () => {
        factory = jest.fn().mockReturnValue(websocketMock);
        const rSocket = new ResilientWebSocket(url, options, factory);
        rSocket.connect();
        expect(factory).toHaveBeenCalledWith('ws://localhost');
    });

    it('notifies "connecting" event when websocket connecting', () => {
        return new Promise<void>((resolve) => {
            options.autoConnect = false;
            const rSocket = createWebSocket();

            rSocket.on(WebSocketEvent.CONNECTING, () => {
                resolve();
            });

            rSocket.connect();
        });
    });

    it('notifies "connection" event when websocket connected', () => {
        return new Promise<void>((resolve) => {
            const rSocket = createWebSocket();

            rSocket.on(WebSocketEvent.CONNECTION, () => {
                resolve();
            });

            expect(websocketMock.addEventListener).toHaveBeenCalledWith('open', expect.any(Function));
            const openCallback = (websocketMock.addEventListener as jest.Mock).mock.calls.find(call => call[0] === 'open')[1];
            openCallback();
        });
    });

    it('notifies "close" event when websocket disconnects', () => {
        return new Promise<void>((resolve) => {
            const rSocket = createWebSocket();

            rSocket.on(WebSocketEvent.CLOSE, () => {
                resolve();
            });

            expect(websocketMock.addEventListener).toHaveBeenCalledWith('close', expect.any(Function));
            const closeCallback = (websocketMock.addEventListener as jest.Mock).mock.calls.find(call => call[0] === 'close')[1];
            closeCallback();
        });
    });

    it('automatically stringifies message when autoJsonify is true', () => {
        options.autoJsonify = true;
        const rSocket = createWebSocket();

        rSocket.send({ message: 'yo' });

        expect(websocketMock.send).toHaveBeenCalledWith('{"message":"yo"}');
    });

    it('supports multiple callbacks', () => {
        return new Promise<void>((resolve) => {
            const rSocket = createWebSocket();

            let callCount = 0;

            rSocket.on(WebSocketEvent.CONNECTION, () => {
                callCount++;
                if (callCount === 2) {
                    resolve();
                }
            });

            rSocket.on(WebSocketEvent.CONNECTION, () => {
                callCount++;
                if (callCount === 2) {
                    resolve();
                }
            });

            expect(websocketMock.addEventListener).toHaveBeenCalledWith('open', expect.any(Function));
            const openCallback = (websocketMock.addEventListener as jest.Mock).mock.calls.find(call => call[0] === 'open')[1];
            openCallback();
        });
    });

    it('supports removing callbacks', () => {
        return new Promise<void>((resolve, reject) => {
            const rSocket = createWebSocket();
            const cb1 = () => reject(new Error('cb1 should not be called!'));
            const cb2 = () => {
                resolve();
            };

            rSocket.on(WebSocketEvent.CONNECTION, cb1);
            rSocket.on(WebSocketEvent.CONNECTION, cb2);

            rSocket.off(WebSocketEvent.CONNECTION, cb1);

            expect(websocketMock.addEventListener).toHaveBeenCalledWith('open', expect.any(Function));
            const openCallback = (websocketMock.addEventListener as jest.Mock).mock.calls.find(call => call[0] === 'open')[1];
            openCallback();
        });
    });

    describe('onMessage', () => {
        it('notifies "message" event when websocket receives a message', () => {
            return new Promise<void>((resolve) => {
                const rSocket = createWebSocket();

                rSocket.on(WebSocketEvent.MESSAGE, message => {
                    expect(message).toBe('my message');
                    resolve();
                });

                expect(websocketMock.addEventListener).toHaveBeenCalledWith('message', expect.any(Function));
                const messageCallback = (websocketMock.addEventListener as jest.Mock).mock.calls.find(call => call[0] === 'message')[1];
                messageCallback({ data: 'my message' });
            });
        });

        it('parses json string and calls with object if autoJsonify is true', () => {
            return new Promise<void>((resolve) => {
                options.autoJsonify = true;
                const rSocket = createWebSocket();

                rSocket.on(WebSocketEvent.MESSAGE, message => {
                    expect(message).toEqual({ message: 'my message' });
                    resolve();
                });

                expect(websocketMock.addEventListener).toHaveBeenCalledWith('message', expect.any(Function));
                const messageCallback = (websocketMock.addEventListener as jest.Mock).mock.calls.find(call => call[0] === 'message')[1];
                messageCallback({ data: '{"message": "my message"}' });
            });
        });
    });

    describe('ping/pong', () => {
        beforeEach(() => {
            options.pingEnabled = true;
            options.pingInterval = 50;
            options.pongTimeout = 50;
            options.pingMessage = 'PINGME';
            options.pongMessage = 'PONGYOU';
        });

        it('sends a ping once connected', () => {
            createWebSocket();

            expect(websocketMock.addEventListener).toHaveBeenCalledWith('open', expect.any(Function));
            const openCallback = (websocketMock.addEventListener as jest.Mock).mock.calls.find(call => call[0] === 'open')[1];
            openCallback();

            jest.advanceTimersByTime(60);

            expect(websocketMock.send).toHaveBeenCalledWith('PINGME');
            expect(websocketMock.send).toHaveBeenCalledTimes(1);
        });

        it('sends multiple pings', () => {
            options.pongTimeout = 500;
            createWebSocket();

            expect(websocketMock.addEventListener).toHaveBeenCalledWith('open', expect.any(Function));
            expect(websocketMock.addEventListener).toHaveBeenCalledWith('message', expect.any(Function));

            const openCallback = (websocketMock.addEventListener as jest.Mock).mock.calls.find(call => call[0] === 'open')[1];
            const messageCallback = (websocketMock.addEventListener as jest.Mock).mock.calls.find(call => call[0] === 'message')[1];

            openCallback();
            // allow a ping to be sent
            jest.advanceTimersByTime(60);

            messageCallback({ data: options.pongMessage });

            // allow another ping to be sent
            jest.advanceTimersByTime(60);

            expect(websocketMock.send).toHaveBeenCalledWith('PINGME');
            expect(websocketMock.send).toHaveBeenCalledTimes(2);
        });

        it('does not timeout when pong received', () => {
            createWebSocket();

            expect(websocketMock.addEventListener).toHaveBeenCalledWith('open', expect.any(Function));
            expect(websocketMock.addEventListener).toHaveBeenCalledWith('message', expect.any(Function));

            const openCallback = (websocketMock.addEventListener as jest.Mock).mock.calls.find(call => call[0] === 'open')[1];
            const messageCallback = (websocketMock.addEventListener as jest.Mock).mock.calls.find(call => call[0] === 'message')[1];

            // call open which will send a ping after 50ms
            openCallback();
            jest.advanceTimersByTime(90);

            // pong back within another 50ms
            messageCallback({ data: options.pongMessage });

            // we should still be open
            expect(websocketMock.close).not.toHaveBeenCalled();
        });

        it('fires pong event when pong received', () => {
            return new Promise<void>((resolve) => {
                const rSocket = createWebSocket();

                rSocket.on(WebSocketEvent.PONG, () => {
                    resolve();
                });

                expect(websocketMock.addEventListener).toHaveBeenCalledWith('open', expect.any(Function));
                expect(websocketMock.addEventListener).toHaveBeenCalledWith('message', expect.any(Function));

                const openCallback = (websocketMock.addEventListener as jest.Mock).mock.calls.find(call => call[0] === 'open')[1];
                const messageCallback = (websocketMock.addEventListener as jest.Mock).mock.calls.find(call => call[0] === 'message')[1];

                openCallback();
                jest.advanceTimersByTime(90);

                messageCallback({ data: options.pongMessage });
            });
        });

        it('times out and closes connection when pong not received', () => {
            createWebSocket();

            expect(websocketMock.addEventListener).toHaveBeenCalledWith('open', expect.any(Function));
            expect(websocketMock.addEventListener).toHaveBeenCalledWith('message', expect.any(Function));

            const openCallback = (websocketMock.addEventListener as jest.Mock).mock.calls.find(call => call[0] === 'open')[1];

            // call open which will send a ping after 50ms
            openCallback();
            jest.advanceTimersByTime(120);
            // no pong

            // closed should have been called
            expect(websocketMock.close).toHaveBeenCalledTimes(1);
        });

        //TODO: no pings during close
    });

    describe('reconnect', () => {
        it('creates a new socket to reconnect when closed', () => {
            createWebSocket();

            expect(websocketMock.addEventListener).toHaveBeenCalledWith('open', expect.any(Function));
            expect(websocketMock.addEventListener).toHaveBeenCalledWith('close', expect.any(Function));

            const openCallback = (websocketMock.addEventListener as jest.Mock).mock.calls.find(call => call[0] === 'open')[1];
            const closeCallback = (websocketMock.addEventListener as jest.Mock).mock.calls.find(call => call[0] === 'close')[1];

            // Ensure we are opened
            openCallback();
            closeCallback();

            // Need to tick pass the reconnection interval
            jest.advanceTimersByTime(1200);

            expect(factory).toHaveBeenCalledTimes(2);
            expect(factory).toHaveBeenCalledWith(url);
        });
    });
});
