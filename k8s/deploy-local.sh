#!/bin/bash
# Script to deploy the telemetry stack to a local Kubernetes cluster

set -e

# Check if we're in a multi-node environment
NODE_COUNT=$(kubectl get nodes --no-headers | wc -l)

if [ $NODE_COUNT -gt 1 ]; then
  echo "Multi-node environment detected ($NODE_COUNT nodes)"
  
  # Ask for node names to label
  echo "Please enter the name of the node to use for monitoring components:"
  kubectl get nodes
  read -p "Monitoring node name: " MONITORING_NODE
  
  # Label the monitoring node
  kubectl label nodes $MONITORING_NODE role=monitoring --overwrite
  
  # Label all other nodes as application nodes
  for NODE in $(kubectl get nodes -o=jsonpath='{.items[*].metadata.name}'); do
    if [ "$NODE" != "$MONITORING_NODE" ]; then
      echo "Labeling $NODE as application node"
      kubectl label nodes $NODE role=application --overwrite
    fi
  done
else
  echo "Single node environment detected. Running all components on the same node."
  echo "Note: nodeSelector settings will be ignored since there's only one node."
  
  # For local development on a single node, we can label it with both roles
  NODE_NAME=$(kubectl get nodes -o=jsonpath='{.items[0].metadata.name}')
  kubectl label nodes $NODE_NAME role=monitoring role=application --overwrite
fi

# Build the application container
echo "Building application container..."
cd ../testNode
docker build -t testnode-app:latest .
cd ../k8s

# Apply Kubernetes resources
echo "Creating namespace..."
kubectl apply -f namespace.yaml

echo "Creating ConfigMaps..."
kubectl apply -f config-maps.yaml

echo "Deploying monitoring stack..."
kubectl apply -f monitoring-deployment.yaml

echo "Deploying Alloy DaemonSet..."
kubectl apply -f alloy-daemonset.yaml

echo "Deploying application..."
kubectl apply -f app-deployment.yaml

echo "Deployment complete. Checking resources..."
kubectl get all -n telemetry-system

echo "Waiting for Grafana pod to be ready..."
kubectl wait --namespace telemetry-system --for=condition=ready pod -l app=grafana --timeout=120s

echo "Forwarding Grafana port to localhost:3000..."
echo "Press Ctrl+C to stop port forwarding when done"
kubectl port-forward -n telemetry-system svc/grafana 3000:3000
