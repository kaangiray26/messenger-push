// push.js
import db from './db.js';
import { JWT } from 'google-auth-library';

class Push {
    constructor() {
        this.access_token = null;
        this.endpoint = `https://fcm.googleapis.com/v1/projects/${process.env.FIREBASE_project_id}/`;
    }

    async init() {
        await this.get_access_token();
    }

    async get_access_token() {
        console.log("Getting access token...");
        const client = new JWT({
            email: process.env.FIREBASE_client_email,
            key: process.env.FIREBASE_private_key,
            scopes: ['https://www.googleapis.com/auth/firebase.messaging'],
        });
        const token = await client.authorize();
        this.access_token = token.access_token;
    }

    async register(content, res) {
        if (!['token', 'secret'].every(key => content.hasOwnProperty(key))) {
            res.writeHead(400, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({
                'message': "Please provide token, secret parameters"
            }))
            return
        }

        const { secret, token } = content;

        const notification_key = await db.register(secret, token);
        if (!notification_key) {
            res.writeHead(500, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({
                'message': "Error registering for push notifications"
            }))
            return
        }
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({
            'notification_key': notification_key
        }))
    }

    async fallback_send(notification_key, from, body) {
        await this.get_access_token();
        await fetch(this.endpoint + "messages:send", {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.access_token}`
            },
            body: JSON.stringify({
                message: {
                    data: {
                        body: body,
                        title: from,
                    },
                    token: notification_key
                }
            })
        })
            .then(response => response.json())
            .catch(err => err);
    }

    async send_metadata(metadata) {
        // Check if metadata is valid
        if (!['from', 'to', 'body'].every(key => metadata.hasOwnProperty(key))) {
            console.log('Please provide from, to, body parameters')
            return
        }

        // Get values
        const { from, to, body } = metadata;

        // Get notification_key
        const notification_key = await db.get_notification_key(to);
        if (!notification_key) {
            console.log('User is not registered for push notifications')
            return
        }

        // Send message
        console.log("Sending push message...");
        const response = await fetch(this.endpoint + "messages:send", {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.access_token}`
            },
            body: JSON.stringify({
                message: {
                    data: {
                        body: body,
                        title: from,
                    },
                    token: notification_key
                }
            })
        })
            .then(response => response.json());

        // Check for authentication error
        if (response.error && response.error.code === 401) {
            console.log("Access token expired. Refreshing...");
            await this.fallback_send(notification_key, from, body);
        }
    }
}

export default Push;