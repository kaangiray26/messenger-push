// db.js
import pgPromise from 'pg-promise';

const pgp = pgPromise();

const db = pgp({
    host: process.env.POSTGRES_HOST,
    port: parseInt(process.env.POSTGRES_PORT),
    database: process.env.POSTGRES_DB,
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD
});

async function init() {
    db.task(async t => {
        // Create tables if they don't exist
        await t.none("CREATE TABLE IF NOT EXISTS notification (id SERIAL PRIMARY KEY, secret TEXT, notification_key TEXT);");
    })
}

async function register(secret, token) {
    // Save token and secret
    const response = await db.one("INSERT INTO notification (secret, notification_key) VALUES ($1, $2) RETURNING notification_key", [secret, token]);
    if (!response) {
        return null;
    }
    return response;
}

async function get_notification_key(secret) {
    const notification_key = await db.oneOrNone("SELECT notification_key FROM notification WHERE secret = $1", [secret]);
    if (!notification_key) {
        return null;
    }
    return notification_key;
}

export default {
    init,
    register,
    get_notification_key
}