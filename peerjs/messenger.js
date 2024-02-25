// messenger.js

import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import Push from './push.js';
import db from './db.js';
import Client from './client.js';
import Realm from './realm.js';
import MessageHandler from './messageHandler.js';

// Options
const options = {
    host: '0.0.0.0',
    port: 3000,
    path: '/peerjs',
    expire_timeout: 5000,
    alive_timeout: 6000,
    concurrent_limit: 5000,
    cleanup_out_msgs: 1000,
}

// Push
const push = new Push();

function check_content_type(req, res) {
    // Check content type
    if (req.headers['content-type'] !== 'application/json') {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.write(JSON.stringify({
            message: "Please provide a JSON body"
        }))
        return false
    }
    return true
}

// Server
const server = createServer((req, res) => {
    // Set headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', '*');
    res.setHeader('Access-Control-Allow-Methods', 'OPTIONS, POST, GET');
    res.setHeader('Access-Control-Max-Age', 2592000);

    if (req.method == 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    // Handle routes
    // Route: /
    if (req.method == "GET" && req.url == "/") {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.write(JSON.stringify({
            message: "Messenger-Push Server is running!",
            version: process.env.version
        }))
        res.end()
        return
    }

    // Route: /register
    if (req.method == "POST" && req.url == "/register") {
        // Check content type
        if (!check_content_type(req, res)) {
            res.end();
            return
        }

        // Get request body
        let body = '';
        req.on('data', (chunk) => {
            body += chunk;
        })
        req.on('end', () => {
            push.register(JSON.parse(body), res);
        })
        return
    }

    // 404
    res.writeHead(404, { 'Content-Type': 'text/plain' })
    res.write("Not found")
    res.end()
    return
});

// Services
const realm = new Realm();
const messageHandler = new MessageHandler(realm, push);

// WebSockets
const wss = new WebSocketServer({
    server,
    path: options.path
})

wss.on('connection', async (ws, req) => {
    // Get the id, token, and key from the URL
    const { searchParams } = new URL(req.url, 'http://localhost:3000');
    const { id, token, key } = Object.fromEntries(searchParams.entries());
    if (!id || !token || !key) {
        ws.send(JSON.stringify({
            type: 'ERROR',
            message: 'No id, token, or key supplied to websocket server'
        }))
        ws.close();
        return;
    }

    // Register the peer
    const response = await db.register_peer(id, token);
    if (!response) {
        ws.send(JSON.stringify({
            type: 'ERROR',
            message: 'Invalid token provided'
        }))
        ws.close();
        return;
    }

    // Create new client if it doesn't exist
    // console.log("New connection:", id);
    const client = new Client(id, key);

    // Send open message
    ws.send(JSON.stringify({
        type: 'OPEN'
    }));

    // Event handlers
    ws.on('message', (data) => {
        const message = JSON.parse(data.toString());
        message.src = id;
        messageHandler.handle(message);
    });

    ws.on('close', () => {
        // console.log("Connection closed:", id);
        client.close();
    })

    ws.on('error', console.error);

    // Attach socket to the client
    client.setSocket(ws);
    realm.setClient(client, id);
});

server.listen(options.port, options.host, async () => {
    // Setup the database
    await db.init();
    await push.init();
    console.log(`Messenger-Push server started on  ${options.host}:${options.port}`);
})