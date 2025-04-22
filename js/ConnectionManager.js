import PeerMessage from './PeerMessage.js';
import Logger from './Logger.js';

class ConnectionManager {
    constructor(peerId) {
        Logger.log('ConnectionManager', 'constructor', { peerId });
        this.connections = new Map();
        this.peerId = peerId;
        this.MAX_PEERS_TO_SHARE = 5;
        this.messageHandlers = new Map();
        this.messageQueue = new Map(); // Map of peerId to queue of messages
        this.retryTimers = new Map(); // Map of peerId to retry timer
        this.MAX_RETRIES = 5;
        this.INITIAL_RETRY_DELAY = 1000; // 1 second
        this.MAX_RETRY_DELAY = 30000; // 30 seconds
    }

    addConnection(conn) {
        Logger.log('ConnectionManager', 'addConnection', { conn });
        if (!this.connections.has(conn.peer)) {
            this.connections.set(conn.peer, conn);
            this.setupConnectionHandlers(conn);
            this.onConnectionCountChanged?.();
        }
    }

    setupConnectionHandlers(conn) {
        Logger.log('ConnectionManager', 'setupConnectionHandlers', { conn });
        conn.on('data', (data) => this.handleIncomingData(data, conn));
        conn.on('close', () => this.handleConnectionClose(conn));
        conn.on('error', (err) => this.handleConnectionError(err, conn));
    }

    registerMessageHandler(type, handler) {
        Logger.log('ConnectionManager', 'registerMessageHandler', { type });
        this.messageHandlers.set(type, handler);
    }

    handleIncomingData(data, conn) {
        Logger.log('ConnectionManager', 'handleIncomingData', { data, conn });
        const handler = this.messageHandlers.get(data.type);
        if (handler) {
            handler(data, conn);
        }
    }

    handleConnectionClose(conn) {
        Logger.log('ConnectionManager', 'handleConnectionClose', { conn });
        this.connections.delete(conn.peer);
        // Clear any pending messages for this peer
        this.messageQueue.delete(conn.peer);
        if (this.retryTimers.has(conn.peer)) {
            clearTimeout(this.retryTimers.get(conn.peer));
            this.retryTimers.delete(conn.peer);
        }
        this.onConnectionCountChanged?.();
    }

    handleConnectionError(err, conn) {
        Logger.log('ConnectionManager', 'handleConnectionError', { err, conn });
        console.error('Connection error:', err);
        this.connections.delete(conn.peer);
        this.onConnectionCountChanged?.();
    }

    getRandomConnections(count) {
        Logger.log('ConnectionManager', 'getRandomConnections', { count });
        const peerIds = Array.from(this.connections.keys());
        return peerIds
            .sort(() => 0.5 - Math.random())
            .slice(0, Math.min(count, peerIds.length));
    }

    broadcastToPeers(message, excludePeerId = null) {
        Logger.log('ConnectionManager', 'broadcastToPeers', { message, excludePeerId });
        const peerIds = this.getRandomConnections(this.MAX_PEERS_TO_SHARE);
        peerIds.forEach(peerId => {
            if (peerId !== excludePeerId) {
                const conn = this.connections.get(peerId);
                if (conn) {
                    conn.send(message);
                }
            }
        });
    }

    sendToPeer(peerId, message) {
        Logger.log('ConnectionManager', 'sendToPeer', { peerId, message });
        const conn = this.connections.get(peerId);
        
        if (conn && conn.open) {
            try {
                conn.send(message);
            } catch (error) {
                Logger.log('ConnectionManager', 'sendToPeer failed - error during send', { peerId, error });
                this.queueMessage(peerId, message);
            }
        } else {
            Logger.log('ConnectionManager', 'sendToPeer failed - connection not open', { peerId });
            this.queueMessage(peerId, message);
        }
    }

    queueMessage(peerId, message) {
        if (!this.messageQueue.has(peerId)) {
            this.messageQueue.set(peerId, []);
        }
        this.messageQueue.get(peerId).push({
            message,
            retryCount: 0,
            nextRetryTime: Date.now() + this.INITIAL_RETRY_DELAY
        });
        this.scheduleRetry(peerId);
    }

    scheduleRetry(peerId) {
        if (this.retryTimers.has(peerId)) {
            clearTimeout(this.retryTimers.get(peerId));
        }

        const queue = this.messageQueue.get(peerId);
        if (!queue || queue.length === 0) return;

        const nextMessage = queue[0];
        const delay = Math.min(
            this.INITIAL_RETRY_DELAY * Math.pow(2, nextMessage.retryCount),
            this.MAX_RETRY_DELAY
        );

        const timer = setTimeout(() => {
            this.processQueue(peerId);
        }, delay);

        this.retryTimers.set(peerId, timer);
    }

    processQueue(peerId) {
        const queue = this.messageQueue.get(peerId);
        if (!queue || queue.length === 0) return;

        const conn = this.connections.get(peerId);
        if (!conn || !conn.open) {
            this.scheduleRetry(peerId);
            return;
        }

        const messageData = queue[0];
        try {
            conn.send(messageData.message);
            queue.shift(); // Remove successfully sent message
            if (queue.length > 0) {
                this.scheduleRetry(peerId);
            } else {
                this.messageQueue.delete(peerId);
                this.retryTimers.delete(peerId);
            }
        } catch (error) {
            messageData.retryCount++;
            if (messageData.retryCount >= this.MAX_RETRIES) {
                Logger.log('ConnectionManager', 'message failed after max retries', { peerId, message: messageData.message });
                queue.shift(); // Remove failed message
                if (queue.length > 0) {
                    this.scheduleRetry(peerId);
                } else {
                    this.messageQueue.delete(peerId);
                    this.retryTimers.delete(peerId);
                }
            } else {
                this.scheduleRetry(peerId);
            }
        }
    }

    getConnectionCount() {
        Logger.log('ConnectionManager', 'getConnectionCount');
        return this.connections.size;
    }
}

export default ConnectionManager; 