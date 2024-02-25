// client.js
import options from './config.js';

class Client {
    constructor(id, token) {
        this.id = id;
        this.token = token;
        this.socket = null;
        this.lastPing = new Date().getTime();
        this.lastSeen = new Date().getTime();
    }

    close() {
        this.lastPing = 0;
        this.socket.close();
    }

    getId() {
        return this.id;
    }

    getToken() {
        return this.token;
    }

    getSocket() {
        return this.socket;
    }

    setSocket(socket) {
        this.socket = socket;
    }

    getlastPing() {
        return this.lastPing;
    }

    getLastSeen() {
        return this.lastSeen;
    }

    setLastPing(lastPing) {
        this.lastPing = lastPing;
        this.lastSeen = lastPing;
    }

    isAlive() {
        const nowTime = new Date().getTime();
        return (nowTime - this.lastPing) < options.alive_timeout;
    }
}

export default Client;