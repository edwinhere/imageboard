import PeerNetwork from './js/PeerNetwork.js';
import Logger from './js/Logger.js';

const SCHELLING_POINT = 'e57a94fb-c0cb-4e60-ac72-4b3bc6336ae8';

// Enable logging
Logger.enable();

// Initialize the network when the page loads
window.addEventListener('load', () => {
    const network = new PeerNetwork(SCHELLING_POINT);
    network.init();
}); 