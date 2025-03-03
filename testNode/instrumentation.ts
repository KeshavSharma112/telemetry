// Force IPv4 addressing
process.env.NODE_OPTIONS = '--dns-result-order=ipv4first';

import * as opentelemetry from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-proto';
import { SimpleLogRecordProcessor, ConsoleLogRecordExporter, LoggerProvider } from '@opentelemetry/sdk-logs';
import { logs } from '@opentelemetry/api-logs';

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

// Register the logger provider
logs.setGlobalLoggerProvider(loggerProvider);

// Create a logger instance
const logger = logs.getLogger('app-logger');

// Store original console methods
const originalConsole = {
  log: console.log,
  error: console.error,
  warn: console.warn,
  info: console.info,
  debug: console.debug,
  trace: console.trace
};

// Helper function to safely stringify any value
function safeStringify(value: any): string {
  if (value instanceof Error) {
    return `${value.name}: ${value.message}\nStack: ${value.stack}`;
  } else if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch (e) {
      return String(value);
    }
  } else {
    return String(value);
  }
}

// Override console methods to also send to OpenTelemetry
console.log = function(...args) {
  // Call original method
  originalConsole.log.apply(console, args);
  // Log to OpenTelemetry
  logger.emit({
    severityNumber: 9, // INFO
    severityText: 'INFO',
    body: args.map(safeStringify).join(' '),
    attributes: { consoleMethod: 'log' }
  });
};

console.error = function(...args) {
  // Call original method
  originalConsole.error.apply(console, args);
  // Log to OpenTelemetry
  logger.emit({
    severityNumber: 17, // ERROR
    severityText: 'ERROR',
    body: args.map(safeStringify).join(' '),
    attributes: { consoleMethod: 'error' }
  });
};

console.warn = function(...args) {
  // Call original method
  originalConsole.warn.apply(console, args);
  // Log to OpenTelemetry
  logger.emit({
    severityNumber: 13, // WARN
    severityText: 'WARN',
    body: args.map(safeStringify).join(' '),
    attributes: { consoleMethod: 'warn' }
  });
};

console.info = function(...args) {
  // Call original method
  originalConsole.info.apply(console, args);
  // Log to OpenTelemetry
  logger.emit({
    severityNumber: 9, // INFO
    severityText: 'INFO',
    body: args.map(safeStringify).join(' '),
    attributes: { consoleMethod: 'info' }
  });
};

console.debug = function(...args) {
  // Call original method
  originalConsole.debug.apply(console, args);
  // Log to OpenTelemetry
  logger.emit({
    severityNumber: 5, // DEBUG
    severityText: 'DEBUG',
    body: args.map(safeStringify).join(' '),
    attributes: { consoleMethod: 'debug' }
  });
};

console.trace = function(...args) {
  // Call original method
  originalConsole.trace.apply(console, args);
  // Log to OpenTelemetry
  logger.emit({
    severityNumber: 1, // TRACE
    severityText: 'TRACE',
    body: args.map(safeStringify).join(' '),
    attributes: { consoleMethod: 'trace' }
  });
};

// Override the Error constructor to log all created errors
const originalError = global.Error;
// @ts-ignore - TypeScript doesn't like us redefining Error
global.Error = function(...args:any[]) {
  const error = new originalError(...args);
  
  // Log all created errors
  logger.emit({
    severityNumber: 17, // ERROR
    severityText: 'ERROR',
    body: `Error created: ${error.name}: ${error.message}\nStack: ${error.stack}`,
    attributes: { errorType: 'created' }
  });
  
  return error;
} as any;

// Instead of modifying prototype directly, use an alternative approach
// @ts-ignore
Object.setPrototypeOf(global.Error, originalError);

// Use a custom Error class for application code
export class AppError extends Error {
  constructor(message: string) {
    super(message);
    // Log to OpenTelemetry
    logger.emit({
      severityNumber: 17, // ERROR
      severityText: 'ERROR',
      body: `AppError created: ${this.name}: ${this.message}\nStack: ${this.stack}`,
      attributes: { errorType: 'app-error' }
    });
  }
}

// Set up the Node SDK with exporters and processors
const sdk = new opentelemetry.NodeSDK({
  // Trace exporter sends to Alloy's OTLP traces endpoint using HTTP
  traceExporter: new OTLPTraceExporter({
    url: 'http://localhost:4318/v1/traces', 
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
    new OTLPTraceExporter({
      url: 'http://localhost:4318/v1/traces',
      headers:{
        'Content-Type': 'application/json'
      }
    })
  ),
  // Auto-instrumentations for Node.js
  instrumentations: [getNodeAutoInstrumentations()],
  // Add resource attributes including service name
  resource: new opentelemetry.resources.Resource({
    'service.name': 'node-service',
  }),
});

// Start the SDK with better error handling
sdk.start()


// Add global error handlers to ensure all errors are logged
process.on('uncaughtException', (error) => {
  // Log to OpenTelemetry before the process exits
  logger.emit({
    severityNumber: 17, // ERROR
    severityText: 'ERROR',
    body: `Uncaught Exception: ${error.name}: ${error.message}\nStack: ${error.stack}`,
    attributes: { errorType: 'uncaughtException' }
  });
  
  // Wait a moment to allow the log to be sent
  setTimeout(() => {
    originalConsole.error('Uncaught Exception:', error);
    // Don't exit the process here, let the application decide
  }, 100);
});

process.on('unhandledRejection', (reason, promise) => {
  // Log to OpenTelemetry
  logger.emit({
    severityNumber: 17, // ERROR
    severityText: 'ERROR',
    body: `Unhandled Promise Rejection: ${reason instanceof Error ? reason.stack : safeStringify(reason)}`,
    attributes: { errorType: 'unhandledRejection' }
  });
  
  // Wait a moment to allow the log to be sent
  setTimeout(() => {
    originalConsole.error('Unhandled Promise Rejection:', reason);
  }, 100);
});