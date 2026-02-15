# BookOn - White-Label Booking Platform

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-14+-blue.svg)](https://www.postgresql.org/)

**BookOn** is a comprehensive, white-label booking management platform designed for schools, clubs, and activity providers. Built with modern technologies, it offers a complete solution for managing venues, activities, bookings, payments, and user management.

## 🚀 Features

### Core Functionality
- **Multi-Venue Management** - Manage multiple venues with different activities
- **Activity Scheduling** - Create and manage recurring or one-time activities
- **Booking System** - Complete booking lifecycle from creation to completion
- **Child Management** - Track children and their activity preferences
- **User Roles** - Parent, Staff, Admin, and Super Admin roles with granular permissions

### Payment & Financial
- **Stripe Integration** - Complete payment processing with Connect accounts
- **Platform Fees** - Configurable platform fees and revenue sharing
- **Refund Management** - Automated refund processing and tracking
- **Financial Reporting** - Comprehensive financial analytics and reporting

### Advanced Features
- **Embeddable Widget** - White-label booking widget for external websites
- **Register System** - Automated attendance tracking and reporting
- **Export & Analytics** - CSV exports, PDF reports, and business intelligence
- **Webhook System** - Real-time integrations with external services
- **Mobile Optimization** - Responsive design with touch-friendly interfaces

### Admin & Management
- **Dashboard Analytics** - Real-time insights and performance metrics
- **Bulk Operations** - Manage multiple bookings, users, and activities
- **Notification System** - Email, SMS, and in-app notifications
- **Audit Trail** - Complete tracking of all system changes

## 🏗️ Architecture

### Backend
- **Node.js** with **Express.js** framework
- **TypeScript** for type safety and better development experience
- **PostgreSQL** database with **Knex.js** query builder
- **Redis** for caching and session management
- **JWT** authentication with role-based access control
- **Stripe** API integration for payments
- **Winston** logging with structured logging

### Frontend
- **React 18** with **TypeScript**
- **Tailwind CSS** for modern, responsive design
- **React Router** for client-side routing
- **Axios** for HTTP client with interceptors
- **Context API** for state management
- **Heroicons** for consistent iconography

### Infrastructure
- **Vercel** deployment for both frontend and backend
- **Neon** PostgreSQL database (serverless)
- **Docker** support for local development
- **Environment-based** configuration
- **Health checks** and monitoring endpoints

## 📋 Prerequisites

- **Node.js** 18+ 
- **PostgreSQL** 14+ (or Neon account)
- **Redis** (optional, for production)
- **Stripe** account for payments
- **Vercel** account for deployment

## 🛠️ Installation

### 1. Clone the Repository
   ```bash
git clone https://github.com/your-username/bookon.git
cd bookon
   ```

### 2. Install Dependencies
   ```bash
# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

### 3. Environment Configuration

#### Backend (.env)
   ```bash
# Database
DATABASE_URL=postgresql://username:password@localhost:5432/bookon

# JWT
JWT_SECRET=your_jwt_secret_here
JWT_REFRESH_SECRET=your_refresh_secret_here

# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PLATFORM_FEE_PERCENTAGE=2.9
STRIPE_PLATFORM_FEE_FIXED=0.30

# Redis (optional)
REDIS_URL=redis://localhost:6379

# Email (optional)
SENDGRID_API_KEY=your_sendgrid_key
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password

# Webhook
WEBHOOK_SECRET=your_webhook_secret
```

#### Frontend (.env)
```bash
VITE_API_BASE_URL=http://localhost:3000/api/v1
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...
```

### 4. Database Setup
   ```bash
cd backend

# Run migrations
npm run db:migrate

# Seed with sample data (optional)
npm run db:seed
```

### 5. Start Development Servers
   ```bash
# Backend (Terminal 1)
cd backend
   npm run dev
   
# Frontend (Terminal 2)
cd frontend
npm run dev
```

## 🚀 Quick Start

### 1. Access the Application
- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3000
- **API Documentation**: http://localhost:3000/api/v1/docs

### 2. Create Admin Account
```bash
# Using the API
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@bookon.com",
    "password": "admin123",
    "firstName": "Admin",
    "lastName": "User",
    "role": "admin"
  }'
```

### 3. Login and Start Using
- Navigate to http://localhost:5173
- Login with your admin credentials
- Start creating venues, activities, and managing bookings

## 📚 API Documentation

Comprehensive API documentation is available at:
- **Local**: http://localhost:3000/api/v1/docs
- **Online**: [API Documentation](./docs/API_DOCUMENTATION.md)

### Key Endpoints
- **Authentication**: `/api/v1/auth/*`
- **Users**: `/api/v1/users/*`
- **Venues**: `/api/v1/venues/*`
- **Activities**: `/api/v1/activities/*`
- **Bookings**: `/api/v1/bookings/*`
- **Payments**: `/api/v1/payments/*`
- **Admin**: `/api/v1/admin/*`
- **Widget**: `/api/v1/widget/*`
- **Webhooks**: `/api/v1/webhooks/*`

## 🧪 Testing

### Run Tests
```bash
cd backend

# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

### Test Coverage
The project maintains high test coverage:
- **Branches**: 80%
- **Functions**: 80%
- **Lines**: 80%
- **Statements**: 80%

## 🚀 Deployment

### Vercel Deployment

#### 1. Backend Deployment
```bash
cd backend
vercel --prod
```

#### 2. Frontend Deployment
```bash
cd frontend
vercel --prod
```

#### 3. Environment Variables
Set all required environment variables in your Vercel project settings.

### Docker Deployment
```bash
# Build and run with Docker Compose
docker-compose up -d

# Or build individual images
docker build -t bookon-backend ./backend
docker build -t bookon-frontend ./frontend
```

## 🔧 Configuration

### Widget Configuration
```javascript
// Example widget configuration
window.BookOnWidgetConfig = {
  venueId: 'venue-uuid',
  theme: 'light',
  primaryColor: '#00806a',
  position: 'bottom-right',
  showLogo: true
};

// Initialize widget
BookOnWidget.init(window.BookOnWidgetConfig);
```

### Stripe Configuration
```javascript
// Platform fee configuration
const platformFee = {
  percentage: 2.9,  // 2.9%
  fixed: 0.30       // £0.30
};

// Connect account setup
const connectAccount = await stripeService.createConnectAccount({
  email: 'venue@example.com',
  country: 'GB',
  business_type: 'individual'
});
```

## 📊 Monitoring & Health Checks

### Health Endpoints
- **Backend Health**: `/health`
- **Database Health**: `/health/db`
- **Webhook Health**: `/api/v1/webhooks/health`

### Logging
- **Structured logging** with Winston
- **Log levels**: error, warn, info, debug
- **Log rotation** for production
- **Centralized logging** for debugging

## 🔒 Security Features

- **JWT Authentication** with refresh tokens
- **Role-based access control** (RBAC)
- **Input validation** and sanitization
- **SQL injection protection** with Knex.js
- **Rate limiting** on sensitive endpoints
- **CORS configuration** for cross-origin requests
- **Helmet.js** for security headers
- **Webhook signature verification**

## 🤝 Contributing

### Development Workflow
1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

### Code Standards
- **TypeScript** for all new code
- **ESLint** and **Prettier** for code formatting
- **Jest** for unit testing
- **Conventional commits** for commit messages

### Testing Requirements
- **Unit tests** for all new functions
- **Integration tests** for API endpoints
- **Maintain 80%+ test coverage**

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

### Documentation
- **API Documentation**: [API_DOCUMENTATION.md](./docs/API_DOCUMENTATION.md)
- **Widget Integration**: [widget-integration.md](./docs/widget-integration.md)
- **Deployment Guide**: [DEPLOYMENT.md](./docs/DEPLOYMENT.md)

### Community
- **Issues**: [GitHub Issues](https://github.com/your-username/bookon/issues)
- **Discussions**: [GitHub Discussions](https://github.com/your-username/bookon/discussions)
- **Wiki**: [Project Wiki](https://github.com/your-username/bookon/wiki)

### Contact
- **Email**: support@bookon.com
- **Website**: https://bookon.com
- **Status Page**: https://status.bookon.com

## 🎯 Roadmap

### Phase 1: Core Platform ✅
- [x] User authentication and management
- [x] Venue and activity management
- [x] Booking system
- [x] Payment processing with Stripe
- [x] Basic admin dashboard

### Phase 2: Advanced Features ✅
- [x] Register system and attendance tracking
- [x] Export functionality (CSV, PDF)
- [x] Advanced reporting and analytics
- [x] Notification system
- [x] Mobile optimization

### Phase 3: Integration & Scale 🚧
- [x] Embeddable widget system
- [x] Webhook infrastructure
- [x] API documentation
- [ ] Multi-language support
- [ ] Advanced analytics dashboard
- [ ] Mobile app (React Native)

### Phase 4: Enterprise Features 📋
- [ ] Multi-tenant architecture
- [ ] Advanced permission system
- [ ] Audit logging and compliance
- [ ] API rate limiting and quotas
- [ ] Advanced webhook management
- [ ] Custom branding and themes

## 🙏 Acknowledgments

- **Stripe** for payment processing
- **Vercel** for hosting and deployment
- **Neon** for serverless PostgreSQL
- **Tailwind CSS** for the design system
- **React** team for the amazing framework
- **Express.js** community for the robust backend framework

---

**Made with ❤️ by the BookOn Team**

*Empowering schools and clubs to manage their activities efficiently and professionally.*
#   t e s t _ b o o k o n  
 