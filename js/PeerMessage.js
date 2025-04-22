import Logger from './Logger.js';

class PeerMessage {
    static TYPE = {
        POST: 'post',
        PEER_LIST: 'peer-list',
        REQUEST_ALL_POSTS_AND_REPLIES: 'request-all-posts-and-replies',
        ALL_POSTS_AND_REPLIES: 'all-posts-and-replies',
    };

    constructor(type, data, broadcast = false, from = null) {
        Logger.log('PeerMessage', 'constructor', { type, data, broadcast, from });
        this.type = type;
        this.data = JSON.parse(JSON.stringify(data)); // Ensure data is serializable
        this.broadcast = broadcast;
        this.from = from;
    }

    static createPostMessage(post, broadcast = true, from = null) {
        Logger.log('PeerMessage', 'createPostMessage', { post, broadcast, from });
        // Create a simple object with only the data we need to send
        const postData = {
            imageUrl: post.imageUrl,
            comment: post.comment,
            timestamp: post.timestamp
        };
        return new PeerMessage(PeerMessage.TYPE.POST, { post: postData }, broadcast, from);
    }

    static createPeerListMessage(peers) {
        Logger.log('PeerMessage', 'createPeerListMessage', { peers });
        // Ensure peers is a simple array
        const peerList = Array.isArray(peers) ? peers : Array.from(peers);
        return new PeerMessage(PeerMessage.TYPE.PEER_LIST, { peers: peerList });
    }

    static createRequestAllPostsAndRepliesMessage() {
        Logger.log('PeerMessage', 'createRequestAllPostsAndRepliesMessage');
        return new PeerMessage(PeerMessage.TYPE.REQUEST_ALL_POSTS_AND_REPLIES, {});
    }

    static createAllPostsAndRepliesMessage(posts) {
        Logger.log('PeerMessage', 'createAllPostsAndRepliesMessage', { posts });
        return new PeerMessage(PeerMessage.TYPE.ALL_POSTS_AND_REPLIES, { posts });
    }

    static createReplyMessage(reply, parentHash, broadcast = true, from = null) {
        Logger.log('PeerMessage', 'createReplyMessage', { reply, parentHash, broadcast, from });
        // Create a simple object with only the data we need to send
        const replyData = {
            imageUrl: reply.imageUrl,
            comment: reply.comment,
            timestamp: reply.timestamp,
            parentHash: parentHash
        };
        return new PeerMessage(PeerMessage.TYPE.POST, { post: replyData }, broadcast, from);
    }
}

export default PeerMessage; 