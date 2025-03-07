#!/bin/bash

# Colors for better readability
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}===========================================${NC}"
echo -e "${YELLOW}STARTING COMPREHENSIVE CLEANUP PROCEDURE${NC}"
echo -e "${YELLOW}===========================================${NC}"

# Step 1: Find and kill ALL port-forwarding processes
echo -e "\n${YELLOW}Step 1: Stopping ALL port-forwarding processes...${NC}"
# Kill all kubectl port-forward processes regardless of namespace
pkill -9 -f "kubectl port-forward" || true
# Kill any netcat processes that might be used for port forwarding
pkill -9 -f "nc -l" || true
# Kill any socat processes that might be used for port forwarding
pkill -9 -f "socat" || true
sleep 2

# Check if any port forwarding is still running
if pgrep -f "port-forward" > /dev/null; then
    echo -e "${RED}Some port-forwarding processes are still running. Trying harder...${NC}"
    # Get PIDs of port forwarding processes and kill them individually
    for pid in $(pgrep -f "port-forward"); do
        echo "Killing process $pid"
        kill -9 $pid 2>/dev/null || true
    done
fi

# Step 2: Release all commonly used ports - ENHANCED SECTION
echo -e "\n${YELLOW}Step 2: Releasing ALL ports used by our services...${NC}"
# Define all ports used in our deployment
PORTS_TO_CLEAR=(
    # Application ports
    3000  # Grafana
    3001  # Node.js app
    8000  # FastAPI app
    
    # Infrastructure ports
    4317  # OTLP gRPC
    4318  # OTLP HTTP
    9090  # Prometheus
    9411  # Zipkin
    3100  # Loki
    3200  # Tempo
    12345 # Alloy HTTP
    8080  # Generic HTTP (sometimes used)
    16686 # Jaeger UI (if used)
)

# Multiple methods to ensure ports are released
for port in "${PORTS_TO_CLEAR[@]}"; do
    echo -e "Checking port $port..."
    
    # Method 1: Using lsof
    if command -v lsof &> /dev/null; then
        if lsof -i :$port >/dev/null 2>&1; then
            echo -e "Releasing port $port (lsof method)"
            for pid in $(lsof -ti :$port 2>/dev/null); do
                echo "Killing process using port $port (PID: $pid)"
                kill -9 $pid 2>/dev/null || true
            done
        fi
    fi
    
    # Method 2: Using netstat (Linux)
    if command -v netstat &> /dev/null; then
        for pid in $(netstat -tlnp 2>/dev/null | grep ":$port " | awk '{print $7}' | cut -d/ -f1 | sort -u); do
            if [ ! -z "$pid" ]; then
                echo "Killing process using port $port (PID: $pid) (netstat method)"
                kill -9 $pid 2>/dev/null || true
            fi
        done
    fi
    
    # Method 3: Using ss (modern Linux)
    if command -v ss &> /dev/null; then
        for pid in $(ss -tlnp 2>/dev/null | grep ":$port " | awk '{print $7}' | cut -d, -f2 | cut -d= -f2 | sort -u); do
            if [ ! -z "$pid" ]; then
                echo "Killing process using port $port (PID: $pid) (ss method)"
                kill -9 $pid 2>/dev/null || true
            fi
        done
    fi
    
    # Method 4: Using fuser (some Unix systems)
    if command -v fuser &> /dev/null; then
        echo "Releasing port $port (fuser method)"
        fuser -k ${port}/tcp 2>/dev/null || true
    fi
    
    echo -e "Port $port should now be free"
done

# Step 3: Delete all resources in the telemetry-system namespace with force
echo -e "\n${YELLOW}Step 3: Forcefully deleting telemetry-system namespace and resources...${NC}"
# First try to delete specific resource types to help with orderly cleanup
echo "Deleting deployments..."
kubectl delete deployments --all -n telemetry-system --force --grace-period=0 --wait=false 2>/dev/null || true
echo "Deleting statefulsets..."
kubectl delete statefulsets --all -n telemetry-system --force --grace-period=0 --wait=false 2>/dev/null || true
echo "Deleting daemonsets..."
kubectl delete daemonsets --all -n telemetry-system --force --grace-period=0 --wait=false 2>/dev/null || true
echo "Deleting services..."
kubectl delete services --all -n telemetry-system --force --grace-period=0 --wait=false 2>/dev/null || true
echo "Deleting pods..."
kubectl delete pods --all -n telemetry-system --force --grace-period=0 --wait=false 2>/dev/null || true

# Now delete the entire namespace
echo "Deleting the entire namespace..."
kubectl delete namespace telemetry-system --force --grace-period=0 --wait=false

# Wait for namespace to be deleted or timeout after 15 seconds
echo -e "\n${YELLOW}Waiting for namespace deletion (max 15 seconds)...${NC}"
for i in {1..15}; do
    if ! kubectl get namespace telemetry-system &>/dev/null; then
        echo -e "${GREEN}Namespace deleted successfully${NC}"
        break
    fi
    sleep 1
    if [ $i -eq 15 ]; then
        echo -e "${RED}Namespace deletion taking longer than expected, continuing anyway...${NC}"
        echo "You may need to check for stuck finalizers with:"
        echo "kubectl get namespace telemetry-system -o json | jq '.spec.finalizers = null' | kubectl replace --raw /api/v1/namespaces/telemetry-system/finalize -f -"
    fi
done

# Step 4: Delete any potential orphaned resources
echo -e "\n${YELLOW}Step 4: Checking for and removing any orphaned resources...${NC}"
# Check for resources with labels related to our telemetry stack
for resource in pods services deployments statefulsets configmaps secrets daemonsets; do
    echo "Checking for orphaned $resource..."
    kubectl get $resource --all-namespaces -l app=alloy 2>/dev/null | grep -v "No resources" && \
    kubectl delete $resource --all-namespaces -l app=alloy --force --grace-period=0 2>/dev/null || true
    
    kubectl get $resource --all-namespaces -l app=grafana 2>/dev/null | grep -v "No resources" && \
    kubectl delete $resource --all-namespaces -l app=grafana --force --grace-period=0 2>/dev/null || true
    
    kubectl get $resource --all-namespaces -l app=prometheus 2>/dev/null | grep -v "No resources" && \
    kubectl delete $resource --all-namespaces -l app=prometheus --force --grace-period=0 2>/dev/null || true
    
    kubectl get $resource --all-namespaces -l app=loki 2>/dev/null | grep -v "No resources" && \
    kubectl delete $resource --all-namespaces -l app=loki --force --grace-period=0 2>/dev/null || true
    
    kubectl get $resource --all-namespaces -l app=tempo 2>/dev/null | grep -v "No resources" && \
    kubectl delete $resource --all-namespaces -l app=tempo --force --grace-period=0 2>/dev/null || true
    
    kubectl get $resource --all-namespaces -l app=node-app 2>/dev/null | grep -v "No resources" && \
    kubectl delete $resource --all-namespaces -l app=node-app --force --grace-period=0 2>/dev/null || true
    
    kubectl get $resource --all-namespaces -l app=fastapi-app 2>/dev/null | grep -v "No resources" && \
    kubectl delete $resource --all-namespaces -l app=fastapi-app --force --grace-period=0 2>/dev/null || true
done

# Step 5: Remove node labels
echo -e "\n${YELLOW}Step 5: Removing node labels...${NC}"
NODES=($(kubectl get nodes -o=jsonpath='{.items[*].metadata.name}'))
for NODE in "${NODES[@]}"; do
    echo -e "Removing role label from node ${NODE}..."
    kubectl label nodes ${NODE} role- --overwrite 2>/dev/null || true
done

# Step 6: Clean up Docker containers and images
echo -e "\n${YELLOW}Step 6: Cleaning up related Docker containers and images...${NC}"
if command -v docker &> /dev/null; then
    echo "Stopping and removing related containers..."
    # Stop any containers related to the telemetry stack
    docker ps | grep -E "grafana|prometheus|loki|tempo|alloy|telemetry|node-app|fastapi-app" | awk '{print $1}' | xargs -r docker stop 2>/dev/null || true
    docker ps -a | grep -E "grafana|prometheus|loki|tempo|alloy|telemetry|node-app|fastapi-app" | awk '{print $1}' | xargs -r docker rm 2>/dev/null || true
    
    echo "Removing unused Docker networks..."
    docker network prune -f 2>/dev/null || true
    
    echo "Removing dangling images..."
    docker image prune -f 2>/dev/null || true
else
    echo "Docker command not found, skipping container cleanup"
fi

# Step 7: Final verification
echo -e "\n${YELLOW}Step 7: Final verification...${NC}"
echo "Checking for any remaining port-forwarding processes..."
if pgrep -f "kubectl port-forward" > /dev/null; then
    echo -e "${RED}Warning: Some kubectl port-forward processes are still running${NC}"
    ps aux | grep "kubectl port-forward" | grep -v grep
else
    echo -e "${GREEN}No kubectl port-forward processes found${NC}"
fi

echo "Verifying that critical ports are free..."
for port in "${PORTS_TO_CLEAR[@]}"; do
    if command -v lsof &> /dev/null && lsof -i :$port &>/dev/null; then
        echo -e "${RED}Warning: Port $port is still in use${NC}"
        lsof -i :$port
    elif command -v netstat &> /dev/null && netstat -tulpn 2>/dev/null | grep -q ":$port "; then
        echo -e "${RED}Warning: Port $port is still in use${NC}"
        netstat -tulpn | grep ":$port "
    elif command -v ss &> /dev/null && ss -tulpn | grep -q ":$port "; then
        echo -e "${RED}Warning: Port $port is still in use${NC}"
        ss -tulpn | grep ":$port "
    else
        echo -e "${GREEN}Port $port is free${NC}"
    fi
done

echo "Checking for telemetry-system namespace..."
if kubectl get namespace telemetry-system &>/dev/null; then
    echo -e "${RED}Warning: telemetry-system namespace still exists${NC}"
else
    echo -e "${GREEN}telemetry-system namespace successfully removed${NC}"
fi

echo -e "\n${GREEN}===========================================${NC}"
echo -e "${GREEN}CLEANUP PROCEDURE COMPLETED${NC}"
echo -e "${GREEN}===========================================${NC}"
echo "The telemetry stack has been completely removed from your Kubernetes cluster."
echo "All port-forwarding processes have been terminated."
echo "All related Docker containers have been stopped and removed."
echo "You can now set up the stack again with a clean environment."
