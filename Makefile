.PHONY: setup-models clean-models

# Default target
all: setup-models

# Setup ML models from NSFWJS
setup-models:
	@echo "Setting up ML models..."
	@if [ ! -d "/tmp/nsfwjs" ]; then \
		git clone https://github.com/infinitered/nsfwjs.git /tmp/nsfwjs; \
	fi
	@mkdir -p public/models
	@cp -r /tmp/nsfwjs/models/* public/models/
	@echo "Models setup complete!"

# Clean up models and temporary files
clean-models:
	@echo "Cleaning up models and temporary files..."
	@rm -rf /tmp/nsfwjs
	@rm -rf public/models/*
	@echo "Cleanup complete!" 