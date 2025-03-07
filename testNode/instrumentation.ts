// Force IPv4 addressing
process.env.NODE_OPTIONS = '--dns-result-order=ipv4first';

import * as opentelemetry from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
//@ts-ignore
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http';
import { SimpleLogRecordProcessor, ConsoleLogRecordExporter, LoggerProvider } from '@opentelemetry/sdk-logs';
import { logs } from '@opentelemetry/api-logs';
import { diag, DiagConsoleLogger, DiagLogLevel } from '@opentelemetry/api';

// Enable diagnostic logging to help debug connection issues
diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.INFO);

// Create the logger provider
const loggerProvider = new LoggerProvider();

// Common exporter options
const commonExporterOptions = {
  headers: {
    'Content-Type': 'application/json'
  },
  timeoutMillis: 15000, // 15 seconds timeout
  concurrencyLimit: 10  // Limit concurrent requests
};

// Add processor for sending to Alloy
loggerProvider.addLogRecordProcessor(new SimpleLogRecordProcessor(
  new OTLPLogExporter({
    url: 'http://localhost:4318/v1/logs',
    ...commonExporterOptions
  })
));

// Also log to console for debugging
loggerProvider.addLogRecordProcessor(new SimpleLogRecordProcessor(
  new ConsoleLogRecordExporter()
));

// Register the logger provider
logs.setGlobalLoggerProvider(loggerProvider);

// Create the trace exporter once
const traceExporter = new OTLPTraceExporter({
  url: 'http://localhost:4318/v1/traces',
  ...commonExporterOptions
});

// Set up the Node SDK with exporters and processors
const sdk = new opentelemetry.NodeSDK({
  // Trace exporter sends to Alloy's OTLP traces endpoint using HTTP
  traceExporter: traceExporter,
  // Metric exporter sends to Alloy's OTLP metrics endpoint using HTTP
  metricReader: new PeriodicExportingMetricReader({
    exporter: new OTLPMetricExporter({
      url: 'http://localhost:4318/v1/metrics',
      ...commonExporterOptions
    }),
    exportIntervalMillis: 15000, // Export every 15 seconds
    exportTimeoutMillis: 10000   // 10 seconds timeout for exports
  }),
  // Use the same trace exporter for the span processor to avoid duplication
  spanProcessor: new opentelemetry.tracing.SimpleSpanProcessor(traceExporter),
  // Auto-instrumentations for Node.js
  instrumentations: [getNodeAutoInstrumentations()],
  // Add resource attributes including service name
  resource: new opentelemetry.resources.Resource({
    'service.name': 'node-service',
  }),
});

// Start the SDK with better error handling
sdk.start()

