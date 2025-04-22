import Logger from './Logger.js';

class PostManager {
    constructor() {
        Logger.log('PostManager', 'constructor');
        this.posts = new Map();
        this.replies = new Map();
        this.onPostAdded = null;
        this.onReplyAdded = null;
    }

    async createPost(imageUrl, comment, parentHash = null) {
        Logger.log('PostManager', 'createPost', { imageUrl, comment, parentHash });
        const post = {
            imageUrl,
            comment,
            timestamp: Date.now(),
            parentHash
        };
        
        const hash = await this.hashPost(post);
        if (!this.posts.has(hash)) {
            if (parentHash) {
                if (!this.replies.has(parentHash)) {
                    this.replies.set(parentHash, new Set());
                }
                this.replies.get(parentHash).add(hash);
                this.posts.set(hash, post);
                this.onReplyAdded?.(post, hash, parentHash);
            } else {
                this.posts.set(hash, post);
                this.onPostAdded?.(post, hash);
            }
            return { post, hash };
        }
        return null;
    }

    async hashPost(post) {
        Logger.log('PostManager', 'hashPost', { post });
        const encoder = new TextEncoder();
        const postContent = {
            comment: post.comment,
            imageUrl: post.imageUrl
        };
        const data = encoder.encode(JSON.stringify(postContent));
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }

    getPost(hash) {
        Logger.log('PostManager', 'getPost', { hash });
        return this.posts.get(hash);
    }

    getAllPostsAndReplies() {
        Logger.log('PostManager', 'getAllPostsAndReplies');
        return Array.from(this.posts.values());
    }

    hasPost(hash) {
        Logger.log('PostManager', 'hasPost', { hash });
        return this.posts.has(hash);
    }

    getReplies(parentHash) {
        Logger.log('PostManager', 'getReplies', { parentHash });
        if (!this.replies.has(parentHash)) {
            return [];
        }
        return Array.from(this.replies.get(parentHash)).map(hash => this.posts.get(hash));
    }

    setOnReplyAdded(callback) {
        Logger.log('PostManager', 'setOnReplyAdded');
        this.onReplyAdded = callback;
    }
}

export default PostManager; 