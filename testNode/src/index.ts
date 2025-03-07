import express, { Express } from 'express';
import { logs, SeverityNumber } from '@opentelemetry/api-logs';
import { trace, Span } from '@opentelemetry/api';
import { rollTheDice } from './dice';

// Get the global tracer and logger
const logger = logs.getLogger('my-app-logger', '1.0.0');

// Add logging utility for beautiful, consistent logs
function logMessage(level: string, message: string, metadata: any = {}) {
  // Create formatted log entry with context
  const logEntry = {
    timestamp: new Date().toISOString(),
    level: level.toUpperCase(),
    message: message,
    ...metadata,
    service: 'node-app'
  };

  // Log to console in JSON format for consistent parsing
  console.log(JSON.stringify(logEntry));
  
  // Also send to OpenTelemetry with proper severity
  const severityMap: {[key: string]: SeverityNumber} = {
    'DEBUG': SeverityNumber.DEBUG,
    'INFO': SeverityNumber.INFO,
    'WARN': SeverityNumber.WARN,
    'ERROR': SeverityNumber.ERROR
  };
  
  logger.emit({
    severityNumber: severityMap[level.toUpperCase()] || SeverityNumber.INFO,
    body: message,
    attributes: { 
      ...metadata,
      timestamp: Date.now(),
      service: 'node-app'
    },
    severityText: level.toUpperCase()
  });
}

// Replace direct console calls with our structured logger
const log = {
  debug: (msg: string, metadata?: any) => logMessage('DEBUG', msg, metadata),
  info: (msg: string, metadata?: any) => logMessage('INFO', msg, metadata),
  warn: (msg: string, metadata?: any) => logMessage('WARN', msg, metadata),
  error: (msg: string, metadata?: any) => logMessage('ERROR', msg, metadata)
};

// Initialize with structured logging
log.info('Application starting', { port: 3001 });

const PORT: number = parseInt(process.env.PORT || '3001');
const app: Express = express();

function getRandomNumber(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1) + min);
}

app.get('/rolldice', (req, res) => {
  const diceRoll = getRandomNumber(1, 6);
  res.send(diceRoll.toString());

  // Log to both OpenTelemetry and stdout
  log.info(`Dice rolled: ${diceRoll}`, { roll_value: diceRoll });
  
  // Emit logs with proper severity numbers and attributes
  logger.emit({
    severityNumber: SeverityNumber.INFO,
    body: 'Dice rolled!',
    attributes: { 
      roll_value: diceRoll,
      timestamp: Date.now()
    },
    severityText: 'INFO'
  });

  if (diceRoll <= 1) {
    log.warn(`Low dice roll: ${diceRoll}`, { roll_value: diceRoll });
    logger.emit({
      severityNumber: SeverityNumber.WARN,
      body: 'Low dice roll!',
      attributes: { 
        roll_value: diceRoll,
        timestamp: Date.now()
      },
      severityText: 'WARN'
    });
  }

  if (diceRoll > 5) {
    log.error(`Unexpectedly high dice roll: ${diceRoll}`, { roll_value: diceRoll, error_description: 'Dice roll should be between 1 and 6' });
    logger.emit({
      severityNumber: SeverityNumber.ERROR,
      body: 'Unexpectedly high dice roll!',
      attributes: {
        roll_value: diceRoll,
        error_description: 'Dice roll should be between 1 and 6',
        timestamp: Date.now()
      },
      severityText: 'ERROR'
    });
  }
});

app.get('/rolldicee', (req, res) => {
  const rolls = req.query.rolls ? parseInt(req.query.rolls.toString()) : NaN;
  if (isNaN(rolls)) {
    log.error('Invalid roll parameter', { error_description: 'Request parameter rolls is missing or not a number' });
    logger.emit({
      severityNumber: SeverityNumber.ERROR,
      body: 'Invalid roll parameter',
      attributes: {
        error_description: 'Request parameter rolls is missing or not a number',
        timestamp: Date.now()
      },
      severityText: 'ERROR'
    });
    
    res
      .status(400)
      .send("Request parameter 'rolls' is missing or not a number.");
    return;
  }
  res.send(JSON.stringify(rollTheDice(rolls, 1, 6)));
});

app.get("/crash",(req,res)=>{
  log.error("Crashing the server");
  process.exit(1);
})

// app.get("/error", (req, res) => {
//   log.info("About to throw an error...");
//   throw new Error("This is a test error thrown from the /error endpoint");
// });

app.get("/async-error", async (req, res) => {
  log.info("About to trigger an async error...");

  return new Promise((resolve, reject) => {
    setTimeout(() => {
      reject(new Error("This is an async error from the /async-error endpoint"));
    }, 100);
  });
});

app.get("/logs", (req, res) => {
  const count = req.query.count ? parseInt(req.query.count.toString()) : 10;
  
  log.info(`Generating ${count} log messages`);
  
  for (let i = 0; i < count; i++) {
    log.info(`Log message ${i}: This is a test log message`);
    if (i % 3 === 0) log.warn(`Warning message ${i}: This is a test warning`);
    if (i % 5 === 0) log.error(`Error message ${i}: This is a test error`);
  }
  
  res.send(`Generated ${count} log messages`);
});

// Debug endpoint to test OTLP logging
app.get('/debug-logs', (req, res) => {
  console.log('Testing console log');
  
  try {
    // Direct logger.emit call
    // logger.emit({
    //   severityNumber: SeverityNumber.INFO,
    //   body: 'Direct logger.emit test at ' + new Date().toISOString(),
    //   attributes: { 
    //     endpoint: '/debug-logs',
    //     timestamp: Date.now()
    //   },
    //   severityText: 'INFO'
    // });
    console.log('Direct logger.emit test at ' + new Date().toISOString());
    
    // Wait a moment to see if we get any errors from the exporter
    setTimeout(() => {
      res.send({
        status: 'Log sent for testing',
        time: new Date().toISOString(),
        note: 'Check Grafana logs. If not appearing, check pod logs for errors.'
      });
    }, 1000);
  } catch (error) {
    console.error('Error sending log:', error);
    res.status(500).send({
      error: 'Failed to send log',
      message: error
    });
  }
});

app.listen(3001, () => {
  log.info(`Listening for requests on http://localhost:3001`);
  
  // Log server startup
  logger.emit({
    severityNumber: SeverityNumber.INFO,
    body: 'Server started',
    attributes: { 
      port: 3001,
      timestamp: Date.now()
    },
    severityText: 'INFO'
  });
});
