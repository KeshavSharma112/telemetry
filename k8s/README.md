# Multi-Node Telemetry Stack for Docker Desktop Kubernetes

This directory contains scripts and Kubernetes manifests to deploy a telemetry stack with monitoring components (Prometheus, Grafana, Tempo, Loki) on monitoring nodes and applications on application nodes.

## Architecture

- **Monitoring Node**: Runs Prometheus, Grafana, Tempo, and Loki
- **Application Node**: Runs your applications
- **All Nodes**: Run Alloy as a DaemonSet to collect and forward telemetry data

## Prerequisites

- Docker Desktop with Kubernetes enabled and configured for multi-node setup
- kubectl configured to work with your Docker Desktop Kubernetes cluster

## Setup Instructions

### Option 1: Automatic Setup with Two Nodes

This option automatically sets up your Docker Desktop Kubernetes cluster with the telemetry stack:

```bash
# Make the script executable
chmod +x setup-multi-node.sh

# Run the setup script
./setup-multi-node.sh
```

This will:
1. Verify you have a two-node Docker Desktop Kubernetes cluster
2. Label the first node as "monitoring" and the second as "application"
3. Build and deploy the telemetry stack
4. Set up port forwarding for Grafana and your application

### Option 2: Interactive Setup

This option allows you to choose which node should be the monitoring node:

```bash
# Make the script executable
chmod +x deploy-local.sh

# Run the deployment script
./deploy-local.sh
```

The script will prompt you to select which node should be the monitoring node, and will label the remaining nodes as application nodes.

## Cleanup

To clean up the resources:

```bash
# Make the script executable
chmod +x cleanup-multi-node.sh

# Run the cleanup script
./cleanup-multi-node.sh
```

This will:
1. Delete the telemetry namespace and all its resources
2. Remove the node labels from your Kubernetes nodes

## Accessing Services

After deployment:
- Grafana: http://localhost:3000
- Your Application: http://localhost:3001

## Data Flow

1. Applications running on application nodes generate telemetry data
2. Monitoring components on monitoring nodes generate their own telemetry
3. Alloy instances on both node types collect local telemetry data
4. All Alloy instances forward data to monitoring services on the monitoring node
5. Grafana visualizes the data from Prometheus, Loki, and Tempo
