# resilient-websocket
A client WebSocket wrapper with support for reconnection and ping/pong with a familiar API. Written in TypeScript

# Installing

```sh
npm install resilient-websocket --save
```

# API

```js
import ResilientWebSocket from 'resilient-websocket';

const opts = {
    autoJsonify: true, // parse json message from server, stringify messages on send,
    pingEnabled: true // send ping / pong messages
};

const rSock = new ResilientWebSocket(url, opts);

rSock.on('connection', () => {
    rSock.on('message', (message) => {
        console.info('recieved message from the server', message);
        rSock.send({ message: 'Right back at ya, buddy!' });
    });
});
```
