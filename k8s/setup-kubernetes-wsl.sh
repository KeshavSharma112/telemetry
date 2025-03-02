#!/bin/bash

# Colors for better readability
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Setting up kubectl in WSL to connect to Docker Desktop Kubernetes...${NC}"

# Ensure Docker Desktop Kubernetes is running in Windows
echo -e "${YELLOW}Make sure Docker Desktop is running and Kubernetes is enabled in Docker Desktop settings${NC}"
echo -e "${YELLOW}Press Enter to continue when Docker Desktop Kubernetes is running...${NC}"
read

# Create .kube directory if it doesn't exist
mkdir -p ~/.kube

# Get Windows username
WIN_USER=$(cmd.exe /c echo %USERNAME% 2>/dev/null | tr -d '\r')
echo -e "${GREEN}Windows username detected: $WIN_USER${NC}"

# Copy config from Windows to WSL
echo -e "${YELLOW}Copying Kubernetes config from Windows to WSL...${NC}"
WIN_KUBE_CONFIG="/mnt/c/Users/$WIN_USER/.kube/config"

if [ -f "$WIN_KUBE_CONFIG" ]; then
    cp "$WIN_KUBE_CONFIG" ~/.kube/config
    echo -e "${GREEN}Kubernetes config copied successfully!${NC}"
else
    echo -e "${RED}Could not find Kubernetes config at $WIN_KUBE_CONFIG${NC}"
    echo -e "${YELLOW}Please make sure Docker Desktop Kubernetes is enabled and try again${NC}"
    exit 1
fi

# Update the server address in the config to use the Windows host
echo -e "${YELLOW}Updating Kubernetes server address to use Windows host...${NC}"
sed -i 's/localhost/host.docker.internal/g' ~/.kube/config

# Test the connection
echo -e "${YELLOW}Testing connection to Kubernetes cluster...${NC}"
if kubectl get nodes; then
    echo -e "${GREEN}Connection successful! You can now use kubectl with Docker Desktop Kubernetes.${NC}"
    
    # Count nodes
    NODE_COUNT=$(kubectl get nodes --no-headers | wc -l)
    echo -e "${GREEN}Found $NODE_COUNT Kubernetes node(s)${NC}"
    
    if [ "$NODE_COUNT" -lt 2 ]; then
        echo -e "${YELLOW}Warning: For multi-node setup, you need at least 2 nodes.${NC}"
        echo -e "${YELLOW}Please enable multi-node support in Docker Desktop's Kubernetes settings.${NC}"
    fi
else
    echo -e "${RED}Connection failed. Please check Docker Desktop Kubernetes status.${NC}"
    echo "Possible issues:"
    echo "1. Docker Desktop is not running"
    echo "2. Kubernetes is not enabled in Docker Desktop settings"
    echo "3. Kubernetes service in Docker Desktop is still starting up"
    exit 1
fi
