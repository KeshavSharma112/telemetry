#!/bin/bash

# Colors for better readability
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Cleaning up telemetry stack resources...${NC}"

# Find and kill port-forwarding processes
echo -e "${YELLOW}Stopping port-forwarding processes...${NC}"
pkill -f "kubectl port-forward -n telemetry-system" || true
sleep 2

# Delete all resources in the telemetry-system namespace
echo -e "${YELLOW}Deleting telemetry-system namespace...${NC}"
kubectl delete namespace telemetry-system --wait=false

# Wait for namespace to be deleted or timeout after 30 seconds
echo -e "${YELLOW}Waiting for namespace deletion (max 30 seconds)...${NC}"
for i in {1..30}; do
    if ! kubectl get namespace telemetry-system &>/dev/null; then
        echo -e "${GREEN}Namespace deleted successfully${NC}"
        break
    fi
    sleep 1
    if [ $i -eq 30 ]; then
        echo -e "${YELLOW}Namespace deletion taking longer than expected, continuing...${NC}"
    fi
done

# Remove node labels
echo -e "${YELLOW}Removing node labels...${NC}"
NODES=($(kubectl get nodes -o=jsonpath='{.items[*].metadata.name}'))
for NODE in "${NODES[@]}"; do
    echo -e "${YELLOW}Removing role label from node ${NODE}...${NC}"
    kubectl label nodes ${NODE} role- --overwrite
done

echo -e "${GREEN}Cleanup complete!${NC}"
echo "The telemetry stack has been cleaned up from your Kubernetes cluster."
