# Security & Performance Improvements

## CRITICAL - Fix Immediately

### 1. Secure Environment Variables
```bash
# Generate new secrets
JWT_SECRET=$(openssl rand -base64 32)
```

- Move all secrets to Railway environment variables
- Remove `.env` from repository completely
- Use strong, unique secrets

### 2. Add Rate Limiting
```javascript
npm install express-rate-limit helmet compression

// In server.js
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const compression = require('compression');

// Security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

// Compression
app.use(compression());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP'
});

const strictLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5, // 5 attempts for auth endpoints
});

app.use('/api/', limiter);
app.use('/login', strictLimiter);
app.use('/register', strictLimiter);
```

### 3. Fix CORS Configuration
```javascript
app.use(cors({
  origin: process.env.FRONTEND_URL || 'https://your-app.railway.app',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
```

### 4. Add Input Validation
```javascript
npm install express-validator

const { body, validationResult } = require('express-validator');

// Example for login endpoint
app.post('/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 }),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  // ... rest of login logic
});
```

## Package.json Cleanup

Move these to devDependencies:
```json
{
  "devDependencies": {
    "@testing-library/dom": "^10.4.0",
    "@testing-library/jest-dom": "^6.6.3",
    "@testing-library/react": "^16.3.0",
    "@testing-library/user-event": "^13.5.0",
    "@lhci/cli": "^0.13.0",
    "@nomicfoundation/hardhat-chai-matchers": "^2.0.9",
    "@nomicfoundation/hardhat-ethers": "^3.0.9",
    "@nomicfoundation/hardhat-ignition": "^0.15.12",
    "@nomicfoundation/hardhat-ignition-ethers": "^0.15.13",
    "@nomicfoundation/hardhat-network-helpers": "^1.0.13",
    "@nomicfoundation/hardhat-toolbox": "^6.0.0",
    "@nomicfoundation/hardhat-verify": "^2.0.14",
    "@nomicfoundation/ignition-core": "^0.15.12"
  }
}
```

## Database Security

### Add MongoDB Query Sanitization
```javascript
npm install express-mongo-sanitize

const mongoSanitize = require('express-mongo-sanitize');
app.use(mongoSanitize());
```

### Fix NoSQL Injection Vulnerability
```javascript
// Bad (current code at line 1144)
const updatedMoment = await Moment.findOneAndUpdate(
  {
    _id: momentId,
    'nftMintHistory.txHash': { $ne: txHash } // Vulnerable to injection
  },
  // ...
);

// Good
const updatedMoment = await Moment.findOneAndUpdate(
  {
    _id: mongoose.Types.ObjectId(momentId),
    'nftMintHistory.txHash': { $ne: String(txHash) }
  },
  // ...
);
```

## Web3 Security

### Secure Private Key Management
- Never store private keys in code
- Use Railway's secure environment variables
- Consider using a key management service (AWS KMS, HashiCorp Vault)

### Add Transaction Monitoring
```javascript
// Log all blockchain transactions
const logTransaction = async (txHash, type, user) => {
  await TransactionLog.create({
    txHash,
    type,
    user,
    timestamp: Date.now(),
    status: 'pending'
  });
};
```

## File Upload Security

### Reduce Upload Limits
```javascript
const upload = multer({
  storage,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB instead of 6GB
    files: 1,
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['video/mp4', 'video/quicktime', 'image/jpeg', 'image/png'];
    if (!allowedMimes.includes(file.mimetype)) {
      return cb(new Error('Invalid file type'), false);
    }
    cb(null, true);
  }
});
```

## Monitoring & Logging

### Add Security Monitoring
```javascript
npm install winston

const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
  ],
});

// Log security events
app.use((req, res, next) => {
  if (req.path.includes('admin') || req.path.includes('login')) {
    logger.info({
      timestamp: new Date(),
      ip: req.ip,
      path: req.path,
      method: req.method,
      user: req.user?.id
    });
  }
  next();
});
```

## Quick Wins

1. **Update Dependencies**
   ```bash
   npm audit fix
   npm update
   ```

2. **Add .env.example**
   ```bash
   # .env.example
   JWT_SECRET=generate-strong-secret-here
   MONGO_URI=your-mongodb-connection-string
   PRIVATE_KEY=never-commit-real-keys
   ```

3. **Add Security Tests**
   ```javascript
   // security.test.js
   describe('Security Tests', () => {
     test('Should not expose sensitive data', async () => {
       const response = await request(app).get('/api/config');
       expect(response.body.privateKey).toBeUndefined();
       expect(response.body.mongoUri).toBeUndefined();
     });
   });
   ```

## Deployment Checklist

- [ ] Remove `.env` file from repository
- [ ] Set all secrets in Railway environment variables
- [ ] Enable HTTPS only
- [ ] Set secure cookie flags
- [ ] Implement rate limiting
- [ ] Add security headers (Helmet)
- [ ] Enable MongoDB connection encryption
- [ ] Set up error monitoring (Sentry)
- [ ] Configure logging
- [ ] Review and update CORS policy
- [ ] Run security audit: `npm audit`