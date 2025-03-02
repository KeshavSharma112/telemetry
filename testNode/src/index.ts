import express, { Express } from 'express';
import { logs, SeverityNumber } from '@opentelemetry/api-logs';
import { trace, Span } from '@opentelemetry/api';
import { rollTheDice } from './dice';

// Get the global tracer and logger
const logger = logs.getLogger('my-app-logger', '1.0.0');

// Add startup log
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

app.listen(PORT, () => {
  console.log(`Listening for requests on http://localhost:${PORT}`);
  
  // Log server startup
  logger.emit({
    severityNumber: SeverityNumber.INFO,
    body: 'Server started',
    attributes: { 
      port: PORT,
      timestamp: Date.now()
    },
    severityText: 'INFO'
  });
});
