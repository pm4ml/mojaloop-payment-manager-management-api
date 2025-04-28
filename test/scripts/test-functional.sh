#!/bin/bash
set -e

# Setup steps
echo "Setting up the environment for functional tests..."
# Debug Jest and reporter configuration
npx jest --config ./jest.config.js --debug

# Run functional tests
echo "Running functional tests..."
npx jest --config ./jest.config.js

# Teardown steps
echo "Cleaning up after functional tests..."