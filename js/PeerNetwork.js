import PeerMessage from './PeerMessage.js';
import ConnectionManager from './ConnectionManager.js';
import PostManager from './PostManager.js';
import UI from './UI.js';
import Logger from './Logger.js';

class PeerNetwork {
    constructor(schellingPoint) {
        Logger.log('PeerNetwork', 'constructor', { schellingPoint });
        this.SCHELLING_POINT = schellingPoint;
        this.PEER_DISCOVERY_INTERVAL = 3000;
        this.PEER_CLEANUP_INTERVAL = 6000;
        this.SCHELLING_POINT_RETRY_INTERVAL = 5000; // 5 seconds between retries
        
        this.postManager = new PostManager();
        this.ui = new UI(this.postManager);
        this.isSchellingPoint = false;
    }

    setupEventHandlers() {
        Logger.log('PeerNetwork', 'setupEventHandlers');
        // Connection manager events
        this.connectionManager.onConnectionCountChanged = () => {
            this.ui.updatePeerCount(this.connectionManager.getConnectionCount());
        };

        // Post manager events
        this.postManager.onPostAdded = (post, hash) => {
            this.ui.createPostElement(post, hash);
        };

        this.postManager.onReplyAdded = (reply, hash, parentHash) => {
            // If we're currently viewing the parent post, update the replies
            if (this.ui.currentPostHash === parentHash) {
                const replyElement = this.ui.createReplyElement(reply);
                this.ui.repliesContainer.appendChild(replyElement);
            }
        };

        // UI events
        this.ui.setOnPostSubmit(async (imageUrl, comment) => {
            const isNSFW = await this.checkNSFW(imageUrl);
            if (isNSFW) {
                Logger.log('PeerNetwork', 'handleIncomingPost', { message: 'NSFW content detected, skipping post' });
                return;
            }
            const result = await this.postManager.createPost(imageUrl, comment);
            if (result) {
                const message = PeerMessage.createPostMessage(result.post, true, this.peer.id);
                this.connectionManager.broadcastToPeers(message);
            }
        });

        this.ui.setOnReplySubmit(async (imageUrl, comment, parentHash) => {
            const isNSFW = await this.checkNSFW(imageUrl);
            if (isNSFW) {
                Logger.log('PeerNetwork', 'handleIncomingReply', { message: 'NSFW content detected, skipping post' });
                return;
            }
            const result = await this.postManager.createPost(imageUrl, comment, parentHash);
            if (result) {
                const message = PeerMessage.createReplyMessage(result.post, parentHash, true, this.peer.id);
                this.connectionManager.broadcastToPeers(message);
            }
        });

        // Message handlers
        this.connectionManager.registerMessageHandler(PeerMessage.TYPE.POST, (data) => {
            this.handleIncomingPost(data);
        });

        this.connectionManager.registerMessageHandler(PeerMessage.TYPE.PEER_LIST, (data) => {
            this.handlePeerList(data);
        });

        this.connectionManager.registerMessageHandler(PeerMessage.TYPE.REQUEST_ALL_POSTS_AND_REPLIES, (data, conn) => {
            this.handleRequestAllPostsAndReplies(data, conn);
        });

        this.connectionManager.registerMessageHandler(PeerMessage.TYPE.ALL_POSTS_AND_REPLIES, (data) => {
            this.handleAllPostsAndReplies(data);
        });
    }

    async init() {
        Logger.log('PeerNetwork', 'init');
        try {
            await this.initializeAsSchellingPoint();
            Logger.log('PeerNetwork', 'initialized as schelling point');
        } catch (err) {
            Logger.log('PeerNetwork', 'failed to initialize as schelling point', { error: err });
            try {
                await this.initializeAsRegularPeer();
                Logger.log('PeerNetwork', 'initialized as regular peer');
            } catch (err) {
                Logger.log('PeerNetwork', 'failed to initialize as regular peer', { error: err });
                throw err;
            }
        }

        this.startPeriodicTasks();
    }

    async initializeAsRegularPeer() {
        Logger.log('PeerNetwork', 'initializeAsRegularPeer');
        this.isSchellingPoint = false; // Explicitly set to false for regular peers
        return new Promise((resolve, reject) => {
            this.peer = new Peer({
                host: '0.peerjs.com',
                port: 443,
                secure: true,
                debug: 0
            });
            
            this.setupPeerHandlers();
            
            this.peer.on('open', (id) => {
                Logger.log('PeerNetwork', 'peer connection opened', { id });
                this.connectionManager = new ConnectionManager(this.peer.id);
                this.setupEventHandlers();
                this.ui.updatePeerId(this.peer.id);
                this.connectToPeer(this.SCHELLING_POINT);
                resolve();
            });

            this.peer.on('error', (err) => {
                Logger.log('PeerNetwork', 'peer connection error', { error: err });
                reject(err);
            });
        });
    }

    async initializeAsSchellingPoint() {
        Logger.log('PeerNetwork', 'initializeAsSchellingPoint');
        this.isSchellingPoint = true;
        return new Promise((resolve, reject) => {
            this.peer = new Peer(this.SCHELLING_POINT, {
                host: '0.peerjs.com',
                port: 443,
                secure: true,
                debug: 0
            });
            
            this.setupPeerHandlers();
            
            this.peer.on('open', (id) => {
                Logger.log('PeerNetwork', 'schelling point connection opened', { id });
                this.connectionManager = new ConnectionManager(this.SCHELLING_POINT);
                this.setupEventHandlers();
                this.ui.updatePeerId(this.SCHELLING_POINT);
                this.ui.updatePeerCount(0);
                
                // Set up a handler to update peer count
                this.connectionManager.onConnectionCountChanged = () => {
                    this.ui.updatePeerCount(this.connectionManager.getConnectionCount());
                };
                
                resolve();
            });

            this.peer.on('error', (err) => {
                Logger.log('PeerNetwork', 'schelling point connection error', { error: err });
                reject(err);
            });
        });
    }

    setupPeerHandlers() {
        Logger.log('PeerNetwork', 'setupPeerHandlers');
        this.peer.on('connection', (conn) => {
            Logger.log('PeerNetwork', 'new connection received', { peerId: conn.peer });
            this.connectionManager.addConnection(conn);
            
            // Request posts from the newly connected peer after the connection is open
            conn.on('open', () => {
                Logger.log('PeerNetwork', 'connection opened', { peerId: conn.peer });
                if (this.isSchellingPoint) {
                    const message = PeerMessage.createRequestAllPostsAndRepliesMessage();
                    this.connectionManager.sendToPeer(conn.peer, message);
                }
            });
        });

        this.peer.on('error', (err) => {
            console.error('PeerJS error:', err);
        });
    }

    startPeriodicTasks() {
        Logger.log('PeerNetwork', 'startPeriodicTasks');
        setInterval(() => this.broadcastPeerList(), this.PEER_DISCOVERY_INTERVAL);
        setInterval(() => this.cleanupUnreachablePeers(), this.PEER_CLEANUP_INTERVAL);
        
        // Only start schelling point retry if we're not the schelling point
        if (!this.isSchellingPoint) {
            Logger.log('PeerNetwork', 'starting schelling point retry interval', { 
                isSchellingPoint: this.isSchellingPoint,
                schellingPoint: this.SCHELLING_POINT,
                interval: this.SCHELLING_POINT_RETRY_INTERVAL 
            });
            setInterval(() => this.retrySchellingPointConnection(), this.SCHELLING_POINT_RETRY_INTERVAL);
        } else {
            Logger.log('PeerNetwork', 'skipping schelling point retry interval - this is the schelling point');
        }
    }

    async broadcastPeerList() {
        Logger.log('PeerNetwork', 'broadcastPeerList');
        // Only try to discover new peers if we have at least one connection
        if (this.connectionManager.connections.size > 0) {
            const randomPeers = this.connectionManager.getRandomConnections(3);
            randomPeers.forEach(peerId => {
                const message = PeerMessage.createPeerListMessage(this.connectionManager.connections.keys());
                this.connectionManager.sendToPeer(peerId, message);
            });
        }
    }

    retrySchellingPointConnection() {
        Logger.log('PeerNetwork', 'retrySchellingPointConnection', {
            hasConnection: this.connectionManager?.connections?.has(this.SCHELLING_POINT),
            connectionCount: this.connectionManager?.connections?.size,
            isSchellingPoint: this.isSchellingPoint
        });
        
        // Only try to connect if we don't have an active connection to the schelling point
        if (!this.connectionManager?.connections?.has(this.SCHELLING_POINT)) {
            Logger.log('PeerNetwork', 'attempting to reconnect to schelling point', {
                schellingPoint: this.SCHELLING_POINT,
                peerId: this.peer?.id
            });
            this.connectToPeer(this.SCHELLING_POINT);
        }
    }

    cleanupUnreachablePeers() {
        Logger.log('PeerNetwork', 'cleanupUnreachablePeers', {
            connectionCount: this.connectionManager?.connections?.size,
            hasSchellingPoint: this.connectionManager?.connections?.has(this.SCHELLING_POINT)
        });
        
        this.connectionManager.connections.forEach((conn, peerId) => {
            if (conn.open === false) {
                Logger.log('PeerNetwork', 'removing unreachable peer', { peerId });
                this.connectionManager.connections.delete(peerId);
                // If the schelling point was disconnected, log it
                if (peerId === this.SCHELLING_POINT) {
                    Logger.log('PeerNetwork', 'schelling point disconnected', {
                        schellingPoint: this.SCHELLING_POINT,
                        peerId: this.peer?.id
                    });
                }
            }
        });
    }

    connectToPeer(peerId) {
        Logger.log('PeerNetwork', 'connectToPeer', { peerId });
        if (peerId === this.peer.id) return;
        
        try {
            const conn = this.peer.connect(peerId, {
                serialization: 'json',
                metadata: {
                    type: 'peer'
                }
            });
            
            conn.on('open', () => {
                Logger.log('PeerNetwork', 'connection opened', { peerId });
                this.connectionManager.addConnection(conn);
                // Request all posts from the newly connected peer
                const message = PeerMessage.createRequestAllPostsAndRepliesMessage();
                this.connectionManager.sendToPeer(peerId, message);
            });
            
            conn.on('error', (err) => {
                Logger.log('PeerNetwork', 'connection error', { peerId, error: err });
            });
        } catch (err) {
            Logger.log('PeerNetwork', 'failed to connect', { peerId, error: err });
        }
    }

    async checkNSFW(imageUrl) {
        try {
            console.log('Loading NSFW model...');
            // Use the built-in model from nsfwjs
            const model = await window.nsfwjs.load('./public/models/mobilenet_v2/model.json');
            console.log('NSFW model loaded successfully');
            
            const img = document.createElement('img');
            img.crossOrigin = 'anonymous';
            
            return new Promise((resolve, reject) => {
                img.onload = async () => {
                    try {
                        console.log('Classifying image:', imageUrl);
                        const predictions = await model.classify(img);
                        console.log('Classification results:', predictions);
                        
                        const nsfwPrediction = predictions.find(p => p.className === 'Porn' || p.className === 'Hentai');
                        if (!nsfwPrediction) {
                            console.log('No NSFW prediction found');
                            resolve(false);
                            return;
                        }
                        console.log('NSFW prediction:', nsfwPrediction);
                        resolve(nsfwPrediction.probability > 0.5); // Consider it NSFW if probability > 50%
                    } catch (error) {
                        console.error('Error classifying image:', error);
                        resolve(false); // Default to safe if there's an error
                    }
                };
                img.onerror = (error) => {
                    console.error('Failed to load image:', imageUrl, error);
                    resolve(false); // Default to safe if image fails to load
                };
                img.src = imageUrl;
            });
        } catch (error) {
            console.error('Error loading NSFW model:', error);
            if (error.message) {
                console.error('Error message:', error.message);
            }
            if (error.stack) {
                console.error('Error stack:', error.stack);
            }
            return false; // Default to safe if model fails to load
        }
    }

    async checkImage(imageUrl) {
        try {
            // Basic URL validation
            if (!imageUrl || typeof imageUrl !== 'string') {
                console.error('Invalid image URL format');
                return false;
            }

            // Check for common attack patterns
            const attackPatterns = [
                /<script.*?>.*?<\/script>/i,
                /javascript:/i,
                /data:/i,
                /vbscript:/i,
                /on\w+\s*=/i,
                /eval\s*\(/i,
                /document\./i,
                /window\./i,
                /alert\s*\(/i,
                /sql/i,
                /union/i,
                /select/i,
                /insert/i,
                /update/i,
                /delete/i,
                /drop/i,
                /--/i
            ];

            for (const pattern of attackPatterns) {
                if (pattern.test(imageUrl)) {
                    console.error('Potential security threat detected in image URL');
                    return false;
                }
            }

            // Validate URL structure
            let url;
            try {
                url = new URL(imageUrl);
            } catch (e) {
                console.error('Invalid URL structure');
                return false;
            }

            // Check for allowed protocols
            const allowedProtocols = ['http:', 'https:'];
            if (!allowedProtocols.includes(url.protocol)) {
                console.error('Unsupported protocol in image URL');
                return false;
            }

            // Check for allowed file extensions
            const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
            const hasValidExtension = allowedExtensions.some(ext => 
                imageUrl.toLowerCase().endsWith(ext)
            );
            
            if (!hasValidExtension) {
                console.error('Unsupported file extension in image URL');
                return false;
            }

            // Check for suspicious characters
            const suspiciousChars = ['<', '>', '"', "'", '\\', ';', '|', '&', '`', '$'];
            if (suspiciousChars.some(char => imageUrl.includes(char))) {
                console.error('Suspicious characters detected in image URL');
                return false;
            }

            // Check URL length
            if (imageUrl.length > 2048) {
                console.error('Image URL exceeds maximum length');
                return false;
            }

            return true;
        } catch (error) {
            console.error('Error checking image URL:', error);
            return false;
        }
    }

    async checkComment(comment) {
        try {
            // Basic comment validation
            if (!comment || typeof comment !== 'string') {
                console.error('Invalid comment format');
                return false;
            }

            // Check for common attack patterns
            const attackPatterns = [
                /<script.*?>.*?<\/script>/i,
                /javascript:/i,
                /data:/i,
                /vbscript:/i,
                /on\w+\s*=/i,
                /eval\s*\(/i,
                /document\./i,
                /window\./i,
                /alert\s*\(/i,
                /sql/i,
                /union/i,
                /select/i,
                /insert/i,
                /update/i,
                /delete/i,
                /drop/i,
                /--/i,
                /<iframe.*?>/i,
                /<embed.*?>/i,
                /<object.*?>/i,
                /<applet.*?>/i,
                /<meta.*?>/i,
                /<link.*?>/i,
                /<style.*?>/i,
                /<base.*?>/i,
                /<form.*?>/i,
                /<input.*?>/i,
                /<button.*?>/i,
                /<textarea.*?>/i,
                /<select.*?>/i,
                /<option.*?>/i,
                /<optgroup.*?>/i,
                /<fieldset.*?>/i,
                /<label.*?>/i,
                /<output.*?>/i,
                /<progress.*?>/i,
                /<meter.*?>/i,
                /<datalist.*?>/i,
                /<keygen.*?>/i
            ];

            for (const pattern of attackPatterns) {
                if (pattern.test(comment)) {
                    console.error('Potential security threat detected in comment');
                    return false;
                }
            }

            // Check for suspicious characters
            const suspiciousChars = ['<', '>', '"', "'", '\\', ';', '|', '&', '`', '$', '%', '@', '#', '^', '*', '(', ')', '[', ']', '{', '}'];
            if (suspiciousChars.some(char => comment.includes(char))) {
                console.error('Suspicious characters detected in comment');
                return false;
            }

            // Check comment length
            if (comment.length > 1000) {
                console.error('Comment exceeds maximum length');
                return false;
            }

            // Check for excessive whitespace
            if (comment.replace(/\s+/g, ' ').length > 1000) {
                console.error('Comment contains excessive whitespace');
                return false;
            }

            // Check for repeated characters (potential spam)
            if (/(.)\1{10,}/.test(comment)) {
                console.error('Comment contains suspicious repeated characters');
                return false;
            }

            // Check for URL patterns
            const urlPattern = /(https?:\/\/[^\s]+)/g;
            if (urlPattern.test(comment)) {
                console.error('URLs are not allowed in comments');
                return false;
            }

            return true;
        } catch (error) {
            console.error('Error checking comment:', error);
            return false;
        }
    }

    async handleIncomingPost(data) {
        Logger.log('PeerNetwork', 'handleIncomingPost', { data });
        const post = data.data.post;
        const hash = await this.postManager.hashPost(post);
        
        if (!this.postManager.hasPost(hash)) {
            // Check if the image URL is secure
            const isSecure = await this.checkImage(post.imageUrl);
            if (!isSecure) {
                Logger.log('PeerNetwork', 'handleIncomingPost', { message: 'Insecure image URL detected, skipping post' });
                return;
            }

            // Check if the comment is secure
            const isCommentSecure = await this.checkComment(post.comment);
            if (!isCommentSecure) {
                Logger.log('PeerNetwork', 'handleIncomingPost', { message: 'Insecure comment detected, skipping post' });
                return;
            }

            // Check if the image is NSFW
            const isNSFW = await this.checkNSFW(post.imageUrl);
            if (isNSFW) {
                Logger.log('PeerNetwork', 'handleIncomingPost', { message: 'NSFW content detected, skipping post' });
                return;
            }

            if (post.parentHash) {
                this.postManager.createPost(post.imageUrl, post.comment, post.parentHash);
                if (data.broadcast) {
                    const message = PeerMessage.createReplyMessage(post, post.parentHash, true, this.peer.id);
                    this.connectionManager.broadcastToPeers(message, data.from);
                }
            } else {
                this.postManager.createPost(post.imageUrl, post.comment);
                if (data.broadcast) {
                    const message = PeerMessage.createPostMessage(post, true, this.peer.id);
                    this.connectionManager.broadcastToPeers(message, data.from);
                }
            }
        }
    }

    handlePeerList(data) {
        Logger.log('PeerNetwork', 'handlePeerList', { data });
        const peers = data.data.peers;
        peers.forEach(peerId => {
            if (!this.connectionManager.connections.has(peerId)) {
                Logger.log('PeerNetwork', 'Connecting to new peer', { peerId });
                this.connectToPeer(peerId);
            }
        });
    }

    async handleRequestAllPostsAndReplies(data, conn) {
        Logger.log('PeerNetwork', 'handleRequestAllPostsAndReplies', { data, conn });
        const allPosts = this.postManager.getAllPostsAndReplies();
        const message = PeerMessage.createAllPostsAndRepliesMessage(allPosts);
        this.connectionManager.sendToPeer(conn.peer, message);
    }

    async handleAllPostsAndReplies(data) {
        Logger.log('PeerNetwork', 'handleAllPostsAndReplies', { data });
        const posts = data.data.posts;
        for (const post of posts) {
            const hash = await this.postManager.hashPost(post);
            if (!this.postManager.hasPost(hash)) {
                const isCommentSecure = await this.checkComment(post.comment);
                if (!isCommentSecure) {
                    Logger.log('PeerNetwork', 'handleAllPostsAndReplies', { message: 'Insecure comment detected, skipping post' });
                    return;
                }
                const isSecure = await this.checkImage(post.imageUrl);
                if (!isSecure) {
                    Logger.log('PeerNetwork', 'handleAllPostsAndReplies', { message: 'Insecure image URL detected, skipping post' });
                    return;
                }
                const isNSFW = await this.checkNSFW(post.imageUrl);
                if (isNSFW) {
                    Logger.log('PeerNetwork', 'handleAllPostsAndReplies', { message: 'NSFW content detected, skipping post' });
                    return;
                }
                if (post.parentHash) {
                    await this.postManager.createPost(post.imageUrl, post.comment, post.parentHash);
                } else {
                    await this.postManager.createPost(post.imageUrl, post.comment);
                }
            }
        }
    }
}

export default PeerNetwork; 