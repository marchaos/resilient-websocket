import td from 'testdouble';
// @ts-ignore
import timers from 'testdouble-timers';

import { expect } from 'chai';
import ResilientWebSocket, {
    ResilientWebSocketOptions,
    WebSocketEvent,
    WebSocketFactory,
} from './ResilientWebSocket';

timers.use(td);

describe('ResilientWebSocket', () => {
    const url = 'ws://localhost';
    let options: ResilientWebSocketOptions;
    let factory: WebSocketFactory;
    let websocketMock: WebSocket;
    let clock: any;

    beforeEach(() => {
        options = {};
        websocketMock = td.object<WebSocket>();

        factory = td.function<WebSocketFactory>();
        td.when(factory(url)).thenReturn(websocketMock);

        // @ts-ignore
        clock = td.timers();
    });

    const createWebSocket = () => new ResilientWebSocket(url, options, factory);

    it('factory passed url', () => {
        factory = td.function<WebSocketFactory>();
        td.when(factory('ws://localhost')).thenReturn(websocketMock);
        const rSocket = createWebSocket();
        rSocket.connect();
    });

    it('notifies "connecting" event when websocket connecting', done => {
        options.autoConnect = false;
        const rSocket = createWebSocket();

        rSocket.on(WebSocketEvent.CONNECTING, () => {
            done();
        });

        rSocket.connect();
    });

    it('notifies "connection" event when websocket connected', done => {
        const captor = td.matchers.captor();
        const rSocket = createWebSocket();

        rSocket.on(WebSocketEvent.CONNECTION, () => {
            done();
        });

        td.verify(websocketMock.addEventListener('open', captor.capture()));
        captor.value();
    });

    it('notifies "close" event when websocket disconnects', done => {
        const captor = td.matchers.captor();
        const rSocket = createWebSocket();

        rSocket.on(WebSocketEvent.CLOSE, () => {
            done();
        });

        td.verify(websocketMock.addEventListener('close', captor.capture()));
        captor.value();
    });

    it('automatically stringifies message when autoJsonify is true', () => {
        options.autoJsonify = true;
        const rSocket = createWebSocket();

        rSocket.send({ message: 'yo' });

        td.verify(websocketMock.send('{"message":"yo"}'));
    });

    it('supports multiple callbacks', done => {
        const captor = td.matchers.captor();
        const rSocket = createWebSocket();

        let callCount = 0;

        rSocket.on(WebSocketEvent.CONNECTION, () => {
            callCount++;
            if (callCount === 2) {
                done();
            }
        });

        rSocket.on(WebSocketEvent.CONNECTION, () => {
            callCount++;
            if (callCount === 2) {
                done();
            }
        });

        td.verify(websocketMock.addEventListener('open', captor.capture()));
        captor.value();
    });

    describe('onMessage', () => {
        it('notifies "message" event when websocket receives a message', done => {
            const captor = td.matchers.captor();
            const rSocket = createWebSocket();

            rSocket.on(WebSocketEvent.MESSAGE, message => {
                expect(message).to.eq('my message');
                done();
            });

            td.verify(
                websocketMock.addEventListener('message', captor.capture())
            );
            captor.value({ data: 'my message' });
        });

        it('parses json string and calls with object if autoJsonify is true', done => {
            options.autoJsonify = true;
            const captor = td.matchers.captor();
            const rSocket = createWebSocket();

            rSocket.on(WebSocketEvent.MESSAGE, message => {
                expect(message).to.deep.eq({ message: 'my message' });
                done();
            });

            td.verify(
                websocketMock.addEventListener('message', captor.capture())
            );
            captor.value({ data: '{"message": "my message"}' });
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
            const captor = td.matchers.captor();
            createWebSocket();

            td.verify(websocketMock.addEventListener('open', captor.capture()));
            captor.value();

            clock.tick(60);

            td.verify(websocketMock.send('PINGME'), { times: 1 });
        });

        it('sends multiple pings', () => {
            options.pongTimeout = 500;
            const captor = td.matchers.captor();
            const messageCaptor = td.matchers.captor();
            createWebSocket();

            td.verify(websocketMock.addEventListener('open', captor.capture()));
            td.verify(
                websocketMock.addEventListener(
                    'message',
                    messageCaptor.capture()
                )
            );

            captor.value();
            // allow a ping to be sent
            clock.tick(60);

            messageCaptor.value({ data: options.pongMessage });

            // allow another ping to be sent
            clock.tick(60);

            td.verify(websocketMock.send('PINGME'), { times: 2 });
        });

        it('does not timeout when pong received', () => {
            const openCaptor = td.matchers.captor();
            const messageCaptor = td.matchers.captor();
            createWebSocket();

            td.verify(
                websocketMock.addEventListener('open', openCaptor.capture())
            );
            td.verify(
                websocketMock.addEventListener(
                    'message',
                    messageCaptor.capture()
                )
            );
            // call open which will send a ping after 50ms
            openCaptor.value();
            clock.tick(90);

            // pong back within another 50ms
            messageCaptor.value({ data: options.pongMessage });

            // we should still be open
            td.verify(websocketMock.close(), { times: 0 });
        });

        it('fires pong event when pong received', done => {
            const openCaptor = td.matchers.captor();
            const messageCaptor = td.matchers.captor();
            const rSocket = createWebSocket();

            rSocket.on(WebSocketEvent.PONG, () => {
                done();
            });

            td.verify(
                websocketMock.addEventListener('open', openCaptor.capture())
            );
            td.verify(
                websocketMock.addEventListener(
                    'message',
                    messageCaptor.capture()
                )
            );
            openCaptor.value();
            clock.tick(90);

            messageCaptor.value({ data: options.pongMessage });
        });

        it('times out and closes connection when pong not received', () => {
            const openCaptor = td.matchers.captor();
            const messageCaptor = td.matchers.captor();
            createWebSocket();

            td.verify(
                websocketMock.addEventListener('open', openCaptor.capture())
            );
            td.verify(
                websocketMock.addEventListener(
                    'message',
                    messageCaptor.capture()
                )
            );
            // call open which will send a ping after 50ms
            openCaptor.value();
            clock.tick(120);
            // no ping

            // closed should have been called
            td.verify(websocketMock.close(), { times: 1 });
        });

        //TODO: no pings during close
    });

    describe('reconnect', () => {
        it('creates a new socket to reconnect when closed', () => {
            const openCaptor = td.matchers.captor();
            const closeCaptor = td.matchers.captor();
            createWebSocket();

            td.verify(
                websocketMock.addEventListener('open', openCaptor.capture())
            );
            td.verify(
                websocketMock.addEventListener('close', closeCaptor.capture())
            );
            // Ensure we are opened
            openCaptor.value();
            closeCaptor.value();

            // Need to tick pass the reconnection interval
            clock.tick(1200);

            td.verify(factory(url), { times: 2 });
        });
    });
});
