# Peer-to-Peer Imageboard

A decentralized imageboard platform that allows users to share and discuss images in a peer-to-peer network. This project combines modern web technologies with peer-to-peer networking to create a censorship-resistant image sharing platform.

## Features

- Decentralized peer-to-peer architecture
- Image sharing and discussion
- Real-time updates
- No central server required
- Built with modern web technologies
- Automated SFW (Safe For Work) content detection using [NSFWJS](https://github.com/infinitered/nsfwjs)
  - Runs entirely client-side for privacy

## Prerequisites

- Modern web browser with WebRTC support
- A web server to host the static files

## Hosting Instructions

The application consists of static files that can be hosted on any web server.
## Configuration

The application can be configured through the following files:

- `config.js`: Main configuration file for peer-to-peer settings
- `index.html`: Main entry point and UI configuration

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

For support, please open an issue in the GitHub repository or contact the maintainers.

## Acknowledgments

- Thanks to all contributors who have helped with this project
- Special thanks to the open-source community for the tools and libraries that made this possible
- SFW content detection powered by [NSFWJS](https://github.com/infinitered/nsfwjs)

## Setup

1. Clone this repository:
```bash
git clone https://github.com/yourusername/imageboard.git
cd imageboard
```

2. Setup ML models (using Makefile):
```bash
# Setup models
make setup-models

# To clean up models (optional)
make clean-models
```

3. Install dependencies and start the application:
```bash
# Add your installation and startup commands here
```
