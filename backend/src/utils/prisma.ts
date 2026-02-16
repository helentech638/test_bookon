import { PrismaClient } from '@prisma/client';

// Create a global Prisma client instance
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Connection retry configuration
const createPrismaClient = () => {
  const isProduction = process.env['NODE_ENV'] === 'production';
  const isDevelopment = process.env['NODE_ENV'] === 'development';
  
  let databaseUrl = process.env['DATABASE_URL'] || '';
  
  // Check if DATABASE_URL is set
  if (!databaseUrl) {
    console.error('\n❌ CRITICAL ERROR: DATABASE_URL environment variable is not set!');
    console.error('\n📝 Instructions:');
    console.error('1. Create a .env or .env.local file in the backend directory');
    console.error('2. Add your database URL:');
    console.error('   DATABASE_URL="postgresql://username:password@localhost:5432/bookon_dev"');
    console.error('\n📚 See LOCAL_DEVELOPMENT_SETUP.md for complete setup instructions\n');
    
    // For development, we'll create a placeholder client that will error when used
    if (isDevelopment) {
      console.warn('⚠️  Using placeholder Prisma client - database operations will fail until DATABASE_URL is set');
    }
  }
  
  // Modify database URL only for production (serverless optimization)
  if (isProduction && databaseUrl) {
    try {
      const url = new URL(databaseUrl);
      // Add parameters to disable prepared statements for serverless
      url.searchParams.set('prepared', 'false');
      url.searchParams.set('pgbouncer', 'true');
      url.searchParams.set('connection_limit', '5');
      url.searchParams.set('pool_timeout', '10');
      url.searchParams.set('sslmode', 'disable');
      url.searchParams.set('connect_timeout', '10');
      url.searchParams.set('statement_timeout', '30000');
      databaseUrl = url.toString();
    } catch (error) {
      console.error('⚠️  Failed to parse DATABASE_URL:', error);
    }
  }
  
  return new PrismaClient({
    log: isProduction ? ['error'] : ['error', 'warn'],
    datasources: {
      db: {
        url: databaseUrl,
      },
    },
    errorFormat: 'minimal',
  });
};

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

// Add connection error handling
// prisma.$on('error', (e) => {
//   console.error('Prisma error:', e);
// });

// Graceful shutdown
if (process.env['NODE_ENV'] !== 'production') {
  globalForPrisma.prisma = prisma;
}

// Add connection health check
export const checkDatabaseConnection = async (): Promise<boolean> => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch (error) {
    console.error('Database connection check failed:', error);
    return false;
  }
};

// Debug function to check which database URL is being used
export const getDatabaseInfo = () => {
  const dbUrl = process.env['DATABASE_URL'];
  const directUrl = process.env['DATABASE_DIRECT_URL'];
  
  return {
    hasPooledUrl: !!dbUrl,
    hasDirectUrl: !!directUrl,
    pooledUrlType: dbUrl?.includes('pooler') ? 'pooled' : 'direct',
    directUrlType: directUrl?.includes('pooler') ? 'pooled' : 'direct',
    // Don't log full URLs for security
    pooledUrlPreview: dbUrl ? `${dbUrl.substring(0, 20)}...` : 'NOT_SET',
    directUrlPreview: directUrl ? `${directUrl.substring(0, 20)}...` : 'NOT_SET'
  };
};

// Wrapper function to handle prepared statement errors and SSL issues
export const safePrismaQuery = async <T>(queryFn: (client: PrismaClient) => Promise<T>): Promise<T> => {
  try {
    return await queryFn(prisma);
  } catch (error: any) {
    // Check if it's any type of prepared statement error
    const isPreparedStatementError = error.message && (
      error.message.includes('prepared statement') ||
      error.code === '42P05' || // prepared statement already exists
      error.code === '26000' || // prepared statement does not exist
      error.code === '08P01'    // bind message parameter mismatch
    );
    
    // Check if it's an SSL certificate error
    const isSSLError = error.message && (
      error.message.includes('SELF_SIGNED_CERT_IN_CHAIN') ||
      error.message.includes('certificate') ||
      error.message.includes('SSL') ||
      error.code === 'SELF_SIGNED_CERT_IN_CHAIN'
    );
    
    // Check if it's a connection pool error
    const isConnectionPoolError = error.message && (
      error.message.includes('connection pool') ||
      error.message.includes('Timed out fetching a new connection') ||
      error.message.includes('connection_limit') ||
      error.message.includes('pool_timeout')
    );
    
    if (isPreparedStatementError || isSSLError || isConnectionPoolError) {
      console.warn('Database connection error detected, retrying with fresh connection...', {
        errorCode: error.code,
        errorMessage: error.message?.substring(0, 100),
        errorType: isPreparedStatementError ? 'prepared_statement' : 
                   isSSLError ? 'ssl_certificate' : 'connection_pool'
      });
      
      // Create a fresh Prisma client instance
      const freshClient = createPrismaClient();
      
      try {
        const result = await queryFn(freshClient);
        // Close the fresh client
        await freshClient.$disconnect();
        return result;
      } catch (retryError) {
        await freshClient.$disconnect();
        throw retryError;
      }
    }
    
    throw error;
  }
};

// Connection cleanup function for serverless environments
export const cleanupConnections = async () => {
  try {
    await prisma.$disconnect();
    console.log('Database connections cleaned up successfully');
  } catch (error) {
    console.error('Error cleaning up database connections:', error);
  }
};

// Add process cleanup handlers for serverless environments
if (process.env['NODE_ENV'] === 'production') {
  process.on('SIGTERM', cleanupConnections);
  process.on('SIGINT', cleanupConnections);
  process.on('beforeExit', cleanupConnections);
}

export default prisma;
