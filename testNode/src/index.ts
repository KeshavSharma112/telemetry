import express, { Express } from 'express';
import { logs, SeverityNumber } from '@opentelemetry/api-logs';
import { trace, Span } from '@opentelemetry/api';
import { rollTheDice } from './dice';

// Get the global tracer and logger
const logger = logs.getLogger('my-app-logger', '1.0.0');

// Add startup log - send to both OpenTelemetry and console
console.log('Application starting');
logger.emit({
  severityNumber: SeverityNumber.INFO,
  body: 'Application starting',
  attributes: { 
    status: 'initializing',
    timestamp: Date.now()
  },
  severityText: 'INFO'
});

const PORT: number = parseInt(process.env.PORT || '3001');
const app: Express = express();

function getRandomNumber(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1) + min);
}

app.get('/rolldice', (req, res) => {
  const diceRoll = getRandomNumber(1, 6);
  res.send(diceRoll.toString());

  // Log to both OpenTelemetry and stdout
  console.log(`Dice rolled: ${diceRoll}`);
  
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
    console.warn(`Low dice roll: ${diceRoll}`);
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
    console.error(`Unexpectedly high dice roll: ${diceRoll}`);
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
    console.error('Invalid roll parameter');
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
  console.error("Crashing the server");
  process.exit(1);
})

app.get("/error", (req, res) => {
  console.log("About to throw an error...");
  throw new Error("This is a test error thrown from the /error endpoint");
});

app.get("/async-error", async (req, res) => {
  console.log("About to trigger an async error...");
  // This will create an unhandled promise rejection
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      reject(new Error("This is an async error from the /async-error endpoint"));
    }, 100);
  });
});

// Add a new endpoint that generates lots of logs
app.get("/logs", (req, res) => {
  const count = req.query.count ? parseInt(req.query.count.toString()) : 10;
  
  console.log(`Generating ${count} log messages`);
  
  for (let i = 0; i < count; i++) {
    console.log(`Log message ${i}: This is a test log message`);
    if (i % 3 === 0) console.warn(`Warning message ${i}: This is a test warning`);
    if (i % 5 === 0) console.error(`Error message ${i}: This is a test error`);
  }
  
  res.send(`Generated ${count} log messages`);
});

app.listen(3001, () => {
  console.log(`Listening for requests on http://localhost:3001`);
  
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
