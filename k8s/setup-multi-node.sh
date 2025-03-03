#!/bin/bash

# Colors for better readability
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${GREEN}Setting up telemetry stack on Docker Desktop Kubernetes...${NC}"
echo -e "${BLUE}Architecture Overview:${NC}"
echo -e "${BLUE}  - Node 1 (Monitoring): Prometheus, Grafana, Tempo, Loki${NC}"
echo -e "${BLUE}  - Node 2 (Application): Your applications${NC}"
echo -e "${BLUE}  - Alloy runs on ALL nodes (as a DaemonSet)${NC}"
echo -e "${BLUE}  - Alloy collects telemetry from apps and monitoring components${NC}"
echo -e "${BLUE}  - Alloy forwards all telemetry to the monitoring services${NC}"

# Check if kubectl is installed and configured
if ! kubectl get nodes &> /dev/null; then
    echo "Kubernetes is not running or kubectl is not configured correctly."
    echo "Make sure Docker Desktop's Kubernetes is enabled and working."
    exit 1
fi

# Check if we have at least two nodes
NODE_COUNT=$(kubectl get nodes --no-headers | wc -l)
if [ $NODE_COUNT -lt 2 ]; then
    echo "This script requires at least 2 Kubernetes nodes, but only found $NODE_COUNT."
    echo "Please ensure your Docker Desktop Kubernetes setup has multiple nodes."
    exit 1
fi

# Show nodes
echo -e "${GREEN}Found $NODE_COUNT Kubernetes nodes:${NC}"
kubectl get nodes

# Get node names
NODES=($(kubectl get nodes -o=jsonpath='{.items[*].metadata.name}'))

# Label the first node as monitoring node and the second as application node
echo -e "${YELLOW}Labeling node ${NODES[0]} as monitoring node...${NC}"
kubectl label nodes ${NODES[0]} role=monitoring --overwrite

echo -e "${YELLOW}Labeling node ${NODES[1]} as application node...${NC}"
kubectl label nodes ${NODES[1]} role=application --overwrite

# Verify labels
echo -e "${GREEN}Node labels:${NC}"
kubectl get nodes --show-labels

# Build the application Docker image
echo -e "${YELLOW}Building application Docker image...${NC}"
cd ../testNode
docker build -t testnode-app:latest .
cd ../k8s

# Deploy telemetry stack
echo -e "${GREEN}Deploying telemetry stack...${NC}"
kubectl apply -f namespace.yaml
kubectl apply -f config-maps.yaml
kubectl apply -f monitoring-deployment.yaml
kubectl apply -f alloy-daemonset.yaml
kubectl apply -f app-deployment.yaml

# Wait for deployments to be ready
echo -e "${YELLOW}Waiting for deployments to be ready...${NC}"
kubectl wait --namespace telemetry-system --for=condition=ready pod -l app=grafana --timeout=120s || true
kubectl wait --namespace telemetry-system --for=condition=ready pod -l app=prometheus --timeout=120s || true
kubectl wait --namespace telemetry-system --for=condition=ready pod -l app=tempo --timeout=120s || true
kubectl wait --namespace telemetry-system --for=condition=ready pod -l app=loki --timeout=120s || true
kubectl wait --namespace telemetry-system --for=condition=ready pod -l app=node-app --timeout=120s || true

# Display all resources
echo -e "${GREEN}All resources:${NC}"
kubectl get all -n telemetry-system -o wide

# Show which pods are running on which nodes
echo -e "${GREEN}Pods by node:${NC}"
echo -e "${YELLOW}Monitoring node (${NODES[0]}):${NC}"
kubectl get pods -n telemetry-system -o wide --field-selector spec.nodeName=${NODES[0]}

echo -e "${YELLOW}Application node (${NODES[1]}):${NC}"
kubectl get pods -n telemetry-system -o wide --field-selector spec.nodeName=${NODES[1]}

# Setup port-forwarding for Grafana and your application in the background
echo -e "${GREEN}Setting up port-forwarding for services...${NC}"
echo "Access Grafana at http://localhost:3000"
kubectl port-forward -n telemetry-system svc/grafana 3000:3000 &
PF1=$!
echo "Access your application at http://localhost:3001"
kubectl port-forward -n telemetry-system svc/node-app 3001:3001 &
PF2=$!
echo "Forwarding OpenTelemetry collector endpoint to http://localhost:4318"
kubectl port-forward -n telemetry-system svc/alloy-agent 4318:4318 &
PF3=$!

echo -e "${GREEN}Setup complete!${NC}"
echo "To access services:"
echo "  - Grafana: http://localhost:3000"
echo "  - Your App: http://localhost:3001"
echo ""
echo "Data flow:"
echo "  1. Applications running on application nodes generate telemetry data"
echo "  2. Monitoring components on monitoring nodes generate their own telemetry"
echo "  3. Alloy instances on both node types collect local telemetry data"
echo "  4. All Alloy instances forward data to monitoring services on the monitoring node"
echo "  5. Grafana visualizes the data from Prometheus, Loki, and Tempo"
echo ""
echo "To clean up when done: ./cleanup-multi-node.sh"
echo "Press Ctrl+C to stop port forwarding"

# Wait for port-forwarding to be interrupted
wait $PF1 $PF2 $PF3
