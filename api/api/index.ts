import 'express-async-errors';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import slowDown from 'express-slow-down';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Immediate logging for Vercel debugging
console.log('🚀 API function starting...');
const reqEnv = ['DATABASE_URL', 'JWT_SECRET', 'JWT_REFRESH_SECRET'];
const missing = reqEnv.filter(k => !process.env[k]);
if (missing.length > 0) {
  console.error('❌ Missing required environment variables:', missing.join(', '));
} else {
  console.log('✅ Environment variables check passed');
}

// Import routes
import authRoutes from '../src/routes/auth';
import userRoutes from '../src/routes/users';
import notificationRoutes from '../src/routes/notifications';
import childrenRoutes from '../src/routes/children';
import childPermissionsRoutes from '../src/routes/child-permissions';
import sessionBlocksRoutes from '../src/routes/session-blocks';
import sessionTemplatesRoutes from '../src/routes/session-templates';
import dashboardRoutes from '../src/routes/dashboard';
import businessDashboardRoutes from '../src/routes/businessDashboard';
import businessActivitiesRoutes from '../src/routes/businessActivities';
import businessFinanceRoutes from '../src/routes/businessFinance';
import businessTemplatesRoutes from '../src/routes/businessTemplates';
import businessVenuesRoutes from '../src/routes/businessVenues';
import businessVenueSetupRoutes from '../src/routes/businessVenueSetup';
import businessCommunicationsRoutes from '../src/routes/businessCommunications';
import businessRegistersRoutes from '../src/routes/businessRegisters';
import businessRegisterSetupRoutes from '../src/routes/businessRegisterSetup';
import businessWidgetsRoutes from '../src/routes/businessWidgets';
import businessUsersRoutes from '../src/routes/businessUsers';
import businessSettingsRoutes from '../src/routes/businessSettings';
import businessNotificationsRoutes from '../src/routes/businessNotifications';
import businessBookingsRoutes from '../src/routes/businessBookings';
import debugRoutes from '../src/routes/debug';
import activitiesRoutes from '../src/routes/activities';
import activityTypesRoutes from '../src/routes/activity-types';
import venuesRoutes from '../src/routes/venues';
import uploadRoutes from '../src/routes/upload';
import bookingsRoutes from '../src/routes/bookings';
import paymentsRoutes from '../src/routes/payments';
import userCreditsRoutes from '../src/routes/userCredits';
import discountsRoutes from '../src/routes/discounts';
import checkoutRoutes from '../src/routes/checkout';
import adminRoutes from '../src/routes/admin';
import widgetRoutes from '../src/routes/widget';
import widgetConfigRoutes from '../src/routes/widget-config';
import registersRoutes from '../src/routes/registers';
import webhooksRoutes from '../src/routes/webhooks';
import setupRoutes from '../src/routes/setup';
import tfcRoutes from '../src/routes/tfc-simple';
import adminTfcRoutes from '../src/routes/admin-tfc';
import cancellationRoutes from '../src/routes/cancellations';
import walletRoutes from '../src/routes/wallet';
import providerSettingsRoutes from '../src/routes/provider-settings';
import auditRoutes from '../src/routes/audit';
import edgeCaseRoutes from '../src/routes/edge-cases';
import dataRetentionRoutes from '../src/routes/data-retention';
import templatesRoutes from '../src/routes/templates';
import coursesRoutes from '../src/routes/courses';
import businessAccountsRoutes from '../src/routes/business-accounts';
import financeReportingRoutes from '../src/routes/finance-reporting';
import communicationsRoutes from '../src/routes/communications';
import financeRoutes from '../src/routes/finance';
import bankFeedRoutes from '../src/routes/bankFeed';
import masterReportsRoutes from '../src/routes/masterReports';
import calendarRoutes from '../src/routes/calendar';

// Import middleware
import { errorHandler } from '../src/middleware/errorHandler';
import { notFound } from '../src/middleware/notFound';
import { logger } from '../src/utils/logger';

const app = express();

// Trust proxy for Vercel deployment
app.set('trust proxy', 1);

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:"],
      scriptSrc: ["'self'", "https://js.stripe.com"],
      frameSrc: ["'self'", "https://js.stripe.com", "https://hooks.stripe.com"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

// CORS configuration - dynamic and robust for Vercel
const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl)
    if (!origin) return callback(null, true);

    // In production, you might want to restrict this further, 
    // but for debugging we reflect the origin (works with credentials)
    callback(null, true);
  },
  credentials: true, // Support credentials even if not currently used
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'Accept',
    'Origin',
    'x-refresh-token',
    'X-Refresh-Token',
  ],
  exposedHeaders: ['Cross-Origin-Resource-Policy', 'Access-Control-Allow-Origin'],
  optionsSuccessStatus: 200, // Some legacy browsers (IE11, various SmartTVs) choke on 204
};

// Apply CORS early
app.use(cors(corsOptions));

// Explicit preflight handler to ensure OPTIONS requests always return headers
app.options('*', (req, res) => {
  const origin = req.get('Origin') || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin, x-refresh-token, X-Refresh-Token');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.sendStatus(200);
});

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env['RATE_LIMIT_WINDOW_MS'] || '900000'), // 15 minutes
  max: process.env['NODE_ENV'] === 'development' ? 5000 : parseInt(process.env['RATE_LIMIT_MAX_REQUESTS'] || '100'),
  message: {
    error: 'Too many requests from this IP, please try again later.',
    retryAfter: Math.ceil(parseInt(process.env['RATE_LIMIT_WINDOW_MS'] || '900000') / 1000),
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/', limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Compression middleware
app.use(compression());

// Logging middleware
app.use(morgan('combined', {
  stream: {
    write: (message: string) => logger.info(message.trim()),
  },
}));

// Health check endpoint
app.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    environment: process.env['NODE_ENV'] || 'development',
  });
});

// Root endpoint
app.get('/', (_req, res) => {
  res.status(200).json({
    message: 'BookOn Backend API',
    status: 'running',
    timestamp: new Date().toISOString(),
  });
});

// API routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/notifications', notificationRoutes);
app.use('/api/v1/children', childrenRoutes);
app.use('/api/v1/child-permissions', childPermissionsRoutes);
app.use('/api/v1/session-blocks', sessionBlocksRoutes);
app.use('/api/v1/session-templates', sessionTemplatesRoutes);
app.use('/api/v1/dashboard', dashboardRoutes);
app.use('/api/v1/dashboard', businessDashboardRoutes);
app.use('/api/v1/business/activities', businessActivitiesRoutes);
app.use('/api/v1/business/finance', businessFinanceRoutes);
app.use('/api/v1/business/templates', businessTemplatesRoutes);
app.use('/api/v1/business/venues', businessVenuesRoutes);
app.use('/api/v1/business/venue-setup', businessVenueSetupRoutes);
app.use('/api/v1/business/communications', businessCommunicationsRoutes);
app.use('/api/v1/business/registers', businessRegistersRoutes);
app.use('/api/v1/business/register-setup', businessRegisterSetupRoutes);
app.use('/api/v1/business/widgets', businessWidgetsRoutes);
app.use('/api/v1/business/users', businessUsersRoutes);
app.use('/api/v1/business/settings', businessSettingsRoutes);
app.use('/api/v1/business/notifications', businessNotificationsRoutes);
app.use('/api/v1/business/bookings', businessBookingsRoutes);
app.use('/api/v1/debug', debugRoutes);
app.use('/api/v1/activities', activitiesRoutes);
app.use('/api/v1/activity-types', activityTypesRoutes);
app.use('/api/v1/venues', venuesRoutes);
app.use('/api/v1/upload', uploadRoutes);
app.use('/api/v1/bookings', bookingsRoutes);
app.use('/api/v1/payments', paymentsRoutes);
app.use('/api/v1/user', userCreditsRoutes);
app.use('/api/v1/discounts', discountsRoutes);
app.use('/api/v1/checkout', checkoutRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/widget', widgetRoutes);
app.use('/api/v1/widget-config', widgetConfigRoutes);
app.use('/api/v1/registers', registersRoutes);
app.use('/api/v1/webhooks', webhooksRoutes);
app.use('/api/v1/setup', setupRoutes);
app.use('/api/v1/tfc', tfcRoutes);
app.use('/api/v1/admin/tfc', adminTfcRoutes);
app.use('/api/v1/cancellations', cancellationRoutes);
app.use('/api/v1/wallet', walletRoutes);
app.use('/api/v1/provider-settings', providerSettingsRoutes);
app.use('/api/v1/audit', auditRoutes);
app.use('/api/v1/edge-cases', edgeCaseRoutes);
app.use('/api/v1/data-retention', dataRetentionRoutes);
app.use('/api/v1/templates', templatesRoutes);
app.use('/api/v1/courses', coursesRoutes);
app.use('/api/v1/business-accounts', businessAccountsRoutes);
app.use('/api/v1/finance', financeReportingRoutes);
app.use('/api/v1/communications', communicationsRoutes);
app.use('/api/v1/finance', financeRoutes);
app.use('/api/v1/bank-feed', bankFeedRoutes);
app.use('/api/v1/master-reports', masterReportsRoutes);
app.use('/api/v1/calendar', calendarRoutes);

// Webhook endpoint for Stripe
app.use('/api/v1/webhooks/stripe', express.raw({ type: 'application/json' }));

// 404 handler
app.use(notFound);

// Error handling middleware (must be last)
app.use(errorHandler);

export default app;
