import * as opentelemetry from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-proto';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-proto';
import { SimpleLogRecordProcessor, ConsoleLogRecordExporter,LoggerProvider } from '@opentelemetry/sdk-logs';
import { logs } from '@opentelemetry/api-logs';
import { ConsoleSpanExporter } from '@opentelemetry/sdk-trace-node';

// Create the logger provider
const loggerProvider = new LoggerProvider();

// Add processor for sending to Alloy
loggerProvider.addLogRecordProcessor(new SimpleLogRecordProcessor(
  new OTLPLogExporter({
    url: 'http://localhost:4318/v1/logs',
    headers:{
      'Content-Type': 'application/json'
    }
  })
));

// Also log to console for debugging
loggerProvider.addLogRecordProcessor(new SimpleLogRecordProcessor(
  new ConsoleLogRecordExporter()
));

// Register the logger provider with the API
logs.setGlobalLoggerProvider(loggerProvider);

const sdk = new opentelemetry.NodeSDK({
  // Trace exporter sends to Alloy's OTLP traces endpoint using HTTP
  traceExporter: new OTLPTraceExporter({
    url: 'http://localhost:4318/v1/traces', // Alloy HTTP port
    headers:{
      'Content-Type': 'application/json'
    }
  }),
  // Metric exporter sends to Alloy's OTLP metrics endpoint using HTTP
  metricReader: new PeriodicExportingMetricReader({
    exporter: new OTLPMetricExporter({
      url: 'http://localhost:4318/v1/metrics',
      headers:{
        'Content-Type': 'application/json'
      }
    }),
  }),
  // Add this to your NodeSDK configuration in instrumentation.ts
spanProcessor: new opentelemetry.tracing.SimpleSpanProcessor(
  new ConsoleSpanExporter()
),
  // Auto-instrumentations for Node.js
  instrumentations: [getNodeAutoInstrumentations()],
  // Add resource attributes including service name
  resource: new opentelemetry.resources.Resource({
    'service.name': 'testNode-app',
    'service.version': '1.0.0',
  }),
});

sdk.start();