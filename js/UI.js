import Logger from './Logger.js';

class UI {
    constructor(postManager) {
        Logger.log('UI', 'constructor');
        this.postManager = postManager;
        this.boardElement = document.getElementById('board');
        this.imageUrlInput = document.getElementById('image-url');
        this.commentInput = document.getElementById('comment-input');
        this.postButton = document.getElementById('post-button');
        this.peerCountElement = document.getElementById('peer-count');
        this.peerIdDisplay = document.getElementById('peer-id-display');
        this.currentPostHash = null; // Track the currently viewed post
        
        // Add reply form elements
        this.replyImageUrlInput = document.createElement('input');
        this.replyImageUrlInput.type = 'text';
        this.replyImageUrlInput.placeholder = 'Image URL for reply';
        this.replyImageUrlInput.className = 'reply-image-url';
        
        this.replyCommentInput = document.createElement('textarea');
        this.replyCommentInput.placeholder = 'Reply to this post...';
        this.replyCommentInput.className = 'reply-comment-input';
        
        this.replyButton = document.createElement('button');
        this.replyButton.textContent = 'Reply';
        this.replyButton.className = 'reply-button';
        
        this.repliesContainer = document.createElement('div');
        this.repliesContainer.className = 'replies-container';
        
        Logger.log('UI', 'elements found', {
            boardElement: !!this.boardElement,
            imageUrlInput: !!this.imageUrlInput,
            commentInput: !!this.commentInput,
            postButton: !!this.postButton,
            peerCountElement: !!this.peerCountElement,
            peerIdDisplay: !!this.peerIdDisplay
        });
        
        this.setupEventListeners();
    }

    setupEventListeners() {
        Logger.log('UI', 'setupEventListeners');
        this.postButton.addEventListener('click', () => {
            const imageUrl = this.imageUrlInput.value;
            const comment = this.commentInput.value;
            
            if (!imageUrl) {
                alert('Please enter an image URL');
                return;
            }
            
            this.onPostSubmit?.(imageUrl, comment);
            
            // Clear inputs
            this.imageUrlInput.value = '';
            this.commentInput.value = '';
        });

        // Add reply button event listener
        this.replyButton.addEventListener('click', () => {
            if (!this.currentPostHash) return;
            
            const imageUrl = this.replyImageUrlInput.value;
            const comment = this.replyCommentInput.value;
            
            if (!imageUrl) {
                alert('Please enter an image URL');
                return;
            }
            
            this.onReplySubmit?.(imageUrl, comment, this.currentPostHash);
            
            // Clear inputs
            this.replyImageUrlInput.value = '';
            this.replyCommentInput.value = '';
        });

        // Add close button event listener
        const closeButton = document.querySelector('.close-button');
        closeButton.addEventListener('click', (e) => {
            e.preventDefault();
            const postView = document.getElementById('post-view');
            postView.classList.remove('active');
            this.currentPostHash = null;
        });
    }

    createPostElement(post, hash) {
        Logger.log('UI', 'createPostElement', { post, hash });
        const postElement = document.createElement('div');
        postElement.className = 'post';
        
        // Create a link to the post view
        const postLink = document.createElement('a');
        postLink.href = '#';
        postLink.onclick = (e) => {
            e.preventDefault();
            this.showPostView(post, hash);
        };
        
        const img = document.createElement('img');
        img.src = post.imageUrl;
        
        const content = document.createElement('div');
        content.className = 'post-content';
        
        const comment = document.createElement('div');
        comment.className = 'post-comment';
        comment.textContent = post.comment;
        
        const timestamp = document.createElement('div');
        timestamp.className = 'post-timestamp';
        timestamp.textContent = new Date(post.timestamp).toLocaleString();
        
        content.appendChild(comment);
        content.appendChild(timestamp);
        
        postLink.appendChild(img);
        postLink.appendChild(content);
        postElement.appendChild(postLink);
        
        this.boardElement.insertBefore(postElement, this.boardElement.firstChild);
    }

    showPostView(post, hash) {
        Logger.log('UI', 'showPostView', { post, hash });
        this.currentPostHash = hash;
        
        const postView = document.getElementById('post-view');
        if (!postView) {
            Logger.log('UI', 'post-view element not found');
            return;
        }
        
        const postViewImage = postView.querySelector('.post-view-image');
        const postViewComment = postView.querySelector('.post-view-comment');
        const postViewTimestamp = postView.querySelector('.post-view-timestamp');
        
        if (!postViewImage || !postViewComment || !postViewTimestamp) {
            Logger.log('UI', 'post view elements not found');
            return;
        }
        
        postViewImage.src = post.imageUrl;
        postViewComment.textContent = post.comment;
        postViewTimestamp.textContent = new Date(post.timestamp).toLocaleString();
        
        // Clear and update replies container
        this.repliesContainer.innerHTML = '';
        const replies = this.postManager.getReplies(hash);
        replies.forEach(reply => {
            const replyElement = this.createReplyElement(reply);
            this.repliesContainer.appendChild(replyElement);
        });
        
        // Add reply form if not already present
        const postViewDetails = postView.querySelector('.post-view-details');
        if (!postViewDetails) {
            Logger.log('UI', 'post-view-details not found');
            return;
        }
        
        if (!postView.querySelector('.reply-form')) {
            const replyForm = document.createElement('div');
            replyForm.className = 'reply-form';
            replyForm.appendChild(this.replyImageUrlInput);
            replyForm.appendChild(this.replyCommentInput);
            replyForm.appendChild(this.replyButton);
            postViewDetails.appendChild(replyForm);
        }
        
        // Add replies container if not already present
        if (!postView.querySelector('.replies-container')) {
            postViewDetails.appendChild(this.repliesContainer);
        }
        
        // Show the post view
        postView.classList.add('active');
        document.body.style.overflow = 'hidden'; // Prevent scrolling of the main page
    }

    createReplyElement(reply) {
        Logger.log('UI', 'createReplyElement', { reply });
        const replyElement = document.createElement('div');
        replyElement.className = 'reply';
        
        const replyImage = document.createElement('img');
        replyImage.src = reply.imageUrl;
        replyImage.className = 'reply-image';
        
        const replyContent = document.createElement('div');
        replyContent.className = 'reply-content';
        
        const replyComment = document.createElement('div');
        replyComment.className = 'reply-comment';
        replyComment.textContent = reply.comment;
        
        const replyTimestamp = document.createElement('div');
        replyTimestamp.className = 'reply-timestamp';
        replyTimestamp.textContent = new Date(reply.timestamp).toLocaleString();
        
        replyContent.appendChild(replyComment);
        replyContent.appendChild(replyTimestamp);
        
        replyElement.appendChild(replyImage);
        replyElement.appendChild(replyContent);
        
        return replyElement;
    }

    updatePeerCount(count) {
        Logger.log('UI', 'updatePeerCount', { count, element: !!this.peerCountElement });
        if (this.peerCountElement) {
            this.peerCountElement.textContent = `${count} peers connected`;
        } else {
            Logger.log('UI', 'peerCountElement not found');
        }
    }

    updatePeerId(peerId) {
        Logger.log('UI', 'updatePeerId', { peerId, element: !!this.peerIdDisplay });
        if (this.peerIdDisplay) {
            this.peerIdDisplay.textContent = `Your Peer ID: ${peerId}`;
        } else {
            Logger.log('UI', 'peerIdDisplay not found');
        }
    }

    setOnPostSubmit(callback) {
        Logger.log('UI', 'setOnPostSubmit');
        this.onPostSubmit = callback;
    }

    setOnReplySubmit(callback) {
        Logger.log('UI', 'setOnReplySubmit');
        this.onReplySubmit = callback;
    }
}

export default UI; 