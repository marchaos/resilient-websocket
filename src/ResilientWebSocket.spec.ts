import td from 'testdouble';
// @ts-ignore
import timers from 'testdouble-timers';

import { expect } from 'chai';
import ResilientWebSocket, {
    ResilientWebSocketOptions,
    WebSocketFactory,
} from './ResilientWebSocket';

timers.use(td);

describe('ResilientWebSocket', () => {
    let options: ResilientWebSocketOptions;
    let factory: WebSocketFactory;
    let websocketMock: WebSocket;
    let clock: any;

    beforeEach(() => {
        options = {
        };
        websocketMock = td.object<WebSocket>();
        factory = () => websocketMock;

        // @ts-ignore
        clock = td.timers();
    });

    const createWebSocket = () => new ResilientWebSocket('ws://localhost', options, factory);

    it('factory passed url', () => {
        factory = td.function<WebSocketFactory>();
        td.when(factory('ws://localhost')).thenReturn(websocketMock);
        const rSocket = createWebSocket();
        rSocket.connect();
    });

    it('notifies "connecting" event when websocket connecting', done => {
        options.autoConnect = false;
        const rSocket = createWebSocket();

        rSocket.on('connecting', () => {
            done();
        });

        rSocket.connect();
    });

    it('notifies "connection" event when websocket connected', done => {
        const captor = td.matchers.captor();
        const rSocket = createWebSocket();

        rSocket.on('connection', () => {
            done();
        });

        td.verify(websocketMock.addEventListener('open', captor.capture()));
        captor.value();
    });

    it('notifies "close" event when websocket disconnects', done => {
        const captor = td.matchers.captor();
        const rSocket = createWebSocket();

        rSocket.on('close', () => {
            done();
        });

        td.verify(websocketMock.addEventListener('close', captor.capture()));
        captor.value();
    });

    it('automatically stringifies message when autoJsonify is true', () => {
        options.autoJsonify = true;
        const rSocket = createWebSocket();

        rSocket.send({message: 'yo'});

        td.verify(websocketMock.send( '{"message":"yo"}'));
    });

    it('supports multiple callbacks', done => {
        const captor = td.matchers.captor();
        const rSocket = createWebSocket();

        let callCount = 0;

        rSocket.on('connection', () => {
            callCount++;
            if (callCount === 2) {
                done();
            }
        });

        rSocket.on('connection', () => {
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

            rSocket.on('message', message => {
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

            rSocket.on('message', message => {
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
            createWebSocket();

            td.verify(websocketMock.addEventListener('open', captor.capture()));
            captor.value();

            clock.tick(120);

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
            messageCaptor.value(options.pingMessage);

            // we should still be open
            td.verify(websocketMock.close(), { times: 0 });
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

        // no pings during close
    });

    describe('reconnect', () => {

    })
});
