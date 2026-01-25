import { prisma, safePrismaQuery } from '../utils/prisma';
import { logger } from '../utils/logger';

export interface GDPRConsent {
  childId: string;
  parentId: string;
  dataTypes: {
    medicalInfo: boolean;
    allergies: boolean;
    photoPermission: boolean;
    walkHomeAlone: boolean;
    emergencyContact: boolean;
    schoolInfo: boolean;
    personalDetails: boolean;
  };
  consentDate: Date;
  expiryDate?: Date;
  purpose: string;
  legalBasis: 'consent' | 'legitimate_interest' | 'contract' | 'legal_obligation';
}

export interface DataAccessRequest {
  userId: string;
  childId?: string;
  requestType: 'access' | 'rectification' | 'erasure' | 'portability' | 'restriction';
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'rejected';
  requestedAt: Date;
  completedAt?: Date;
}

export class GDPRComplianceService {
  /**
   * Record GDPR consent for child data processing
   */
  static async recordConsent(consent: GDPRConsent): Promise<void> {
    try {
      await safePrismaQuery(async (client) => {
        return await client.gdprConsent.create({
          data: {
            childId: consent.childId,
            parentId: consent.parentId,
            medicalInfoConsent: consent.dataTypes.medicalInfo,
            allergiesConsent: consent.dataTypes.allergies,
            photoPermissionConsent: consent.dataTypes.photoPermission,
            walkHomeAloneConsent: consent.dataTypes.walkHomeAlone,
            emergencyContactConsent: consent.dataTypes.emergencyContact,
            schoolInfoConsent: consent.dataTypes.schoolInfo,
            personalDetailsConsent: consent.dataTypes.personalDetails,
            consentDate: consent.consentDate,
            expiryDate: consent.expiryDate,
            purpose: consent.purpose,
            legalBasis: consent.legalBasis,
            createdAt: new Date(),
            updatedAt: new Date()
          }
        });
      });

      logger.info(`GDPR consent recorded for child ${consent.childId}`, {
        parentId: consent.parentId,
        dataTypes: consent.dataTypes,
        legalBasis: consent.legalBasis
      });

    } catch (error) {
      logger.error('Error recording GDPR consent:', error);
      throw error;
    }
  }

  /**
   * Check if consent exists and is valid for specific data type
   */
  static async hasValidConsent(
    childId: string,
    dataType: keyof GDPRConsent['dataTypes'],
    purpose: string
  ): Promise<boolean> {
    try {
      const consent = await safePrismaQuery(async (client) => {
        return await client.gdprConsent.findFirst({
          where: {
            childId,
            purpose,
            [this.mapDataTypeToField(dataType)]: true,
            OR: [
              { expiryDate: null },
              { expiryDate: { gt: new Date() } }
            ]
          },
          orderBy: { consentDate: 'desc' }
        });
      });

      return !!consent;
    } catch (error) {
      logger.error('Error checking GDPR consent:', error);
      return false; // Default to no consent if error
    }
  }

  /**
   * Filter child data based on consent
   */
  static async filterChildDataByConsent(
    childData: any,
    purpose: string
  ): Promise<any> {
    try {
      const filteredData = { ...childData };

      // Check consent for each sensitive data type
      const consentChecks = await Promise.all([
        this.hasValidConsent(childData.id, 'medicalInfo', purpose),
        this.hasValidConsent(childData.id, 'allergies', purpose),
        this.hasValidConsent(childData.id, 'photoPermission', purpose),
        this.hasValidConsent(childData.id, 'walkHomeAlone', purpose),
        this.hasValidConsent(childData.id, 'emergencyContact', purpose),
        this.hasValidConsent(childData.id, 'schoolInfo', purpose),
        this.hasValidConsent(childData.id, 'personalDetails', purpose)
      ]);

      const [
        medicalConsent,
        allergiesConsent,
        photoConsent,
        walkHomeConsent,
        emergencyConsent,
        schoolConsent,
        personalConsent
      ] = consentChecks;

      // Remove data if no consent
      if (!medicalConsent) {
        delete filteredData.medicalInfo;
      }
      if (!allergiesConsent) {
        delete filteredData.allergies;
      }
      if (!photoConsent) {
        delete filteredData.permissions?.consentToPhotography;
      }
      if (!walkHomeConsent) {
        delete filteredData.permissions?.consentToWalkHome;
      }
      if (!emergencyConsent) {
        delete filteredData.permissions?.consentToEmergencyContact;
      }
      if (!schoolConsent) {
        delete filteredData.school;
        delete filteredData.class;
      }
      if (!personalConsent) {
        delete filteredData.dateOfBirth;
        delete filteredData.yearGroup;
      }

      return filteredData;
    } catch (error) {
      logger.error('Error filtering child data by consent:', error);
      return childData; // Return original data if filtering fails
    }
  }

  /**
   * Create data access request
   */
  static async createDataAccessRequest(request: DataAccessRequest): Promise<void> {
    try {
      await safePrismaQuery(async (client) => {
        return await client.dataAccessRequest.create({
          data: {
            userId: request.userId,
            childId: request.childId || null,
            requestType: request.requestType,
            description: request.description,
            status: request.status,
            requestedAt: request.requestedAt,
            completedAt: request.completedAt || null,
            createdAt: new Date(),
            updatedAt: new Date()
          }
        });
      });

      logger.info(`Data access request created for user ${request.userId}`, {
        requestType: request.requestType,
        childId: request.childId
      });

    } catch (error) {
      logger.error('Error creating data access request:', error);
      throw error;
    }
  }

  /**
   * Process data access request
   */
  static async processDataAccessRequest(
    requestId: string,
    status: 'completed' | 'rejected',
    response?: string
  ): Promise<void> {
    try {
      await safePrismaQuery(async (client) => {
        return await client.dataAccessRequest.update({
          where: { id: requestId },
          data: {
            status,
            response: response || null,
            completedAt: status === 'completed' ? new Date() : null,
            updatedAt: new Date()
          }
        });
      });

      logger.info(`Data access request ${requestId} processed`, {
        status,
        hasResponse: !!response
      });

    } catch (error) {
      logger.error('Error processing data access request:', error);
      throw error;
    }
  }

  /**
   * Get all data access requests for a user
   */
  static async getUserDataAccessRequests(userId: string): Promise<DataAccessRequest[]> {
    try {
      const requests = await safePrismaQuery(async (client) => {
        return await client.dataAccessRequest.findMany({
          where: { userId },
          orderBy: { requestedAt: 'desc' }
        });
      });

      return requests.map(request => ({
        userId: request.userId,
        childId: request.childId || '',
        requestType: request.requestType as any,
        description: request.description,
        status: request.status as any,
        requestedAt: request.requestedAt,
        completedAt: request.completedAt
      }));

    } catch (error) {
      logger.error('Error getting user data access requests:', error);
      throw error;
    }
  }

  /**
   * Audit data access for compliance
   */
  static async auditDataAccess(
    userId: string,
    childId: string,
    dataAccessed: string[],
    purpose: string,
    accessedBy: string
  ): Promise<void> {
    try {
      await safePrismaQuery(async (client) => {
        return await client.dataAccessAudit.create({
          data: {
            userId,
            childId,
            dataAccessed,
            purpose,
            accessedBy,
            timestamp: new Date()
          }
        });
      });

      logger.info(`Data access audited for child ${childId}`, {
        userId,
        dataAccessed,
        purpose,
        accessedBy
      });

    } catch (error) {
      logger.error('Error auditing data access:', error);
      // Don't throw - audit failures shouldn't break the main flow
    }
  }

  /**
   * Get consent history for a child
   */
  static async getChildConsentHistory(childId: string): Promise<GDPRConsent[]> {
    try {
      const consents = await safePrismaQuery(async (client) => {
        return await client.gDPRConsent.findMany({
          where: { childId },
          orderBy: { consentDate: 'desc' }
        });
      });

      return consents.map((consent: any) => ({
        childId: consent.childId,
        parentId: consent.parentId,
        dataTypes: {
          medicalInfo: consent.medicalInfoConsent,
          allergies: consent.allergiesConsent,
          photoPermission: consent.photoPermissionConsent,
          walkHomeAlone: consent.walkHomeAloneConsent,
          emergencyContact: consent.emergencyContactConsent,
          schoolInfo: consent.schoolInfoConsent,
          personalDetails: consent.personalDetailsConsent
        },
        consentDate: consent.consentDate,
        expiryDate: consent.expiryDate,
        purpose: consent.purpose,
        legalBasis: consent.legalBasis as any
      }));

    } catch (error) {
      logger.error('Error getting child consent history:', error);
      throw error;
    }
  }

  /**
   * Map data type to database field name
   */
  private static mapDataTypeToField(dataType: keyof GDPRConsent['dataTypes']): string {
    const mapping: Record<keyof GDPRConsent['dataTypes'], string> = {
      medicalInfo: 'medicalInfoConsent',
      allergies: 'allergiesConsent',
      photoPermission: 'photoPermissionConsent',
      walkHomeAlone: 'walkHomeAloneConsent',
      emergencyContact: 'emergencyContactConsent',
      schoolInfo: 'schoolInfoConsent',
      personalDetails: 'personalDetailsConsent'
    };

    return mapping[dataType];
  }

  /**
   * Check if user has admin access to view sensitive data
   */
  static async hasAdminAccess(userId: string, venueId?: string): Promise<boolean> {
    try {
      const user = await safePrismaQuery(async (client) => {
        return await client.user.findUnique({
          where: { id: userId },
          select: { role: true }
        });
      });

      if (!user) {
        return false;
      }

      // Admins and business owners have access
      if (user.role === 'admin') {
        return true;
      }

      if (user.role === 'business' && venueId) {
        // Check if user owns the venue
        const venue = await safePrismaQuery(async (client) => {
          return await client.venue.findFirst({
            where: {
              id: venueId,
              ownerId: userId
            }
          });
        });

        return !!venue;
      }

      return false;
    } catch (error) {
      logger.error('Error checking admin access:', error);
      return false;
    }
  }

  /**
   * Generate data export for user request
   */
  static async generateDataExport(userId: string, childId?: string): Promise<any> {
    try {
      const exportData: any = {
        userId,
        childId,
        exportedAt: new Date(),
        data: {}
      };

      // Get user data
      const user = await safePrismaQuery(async (client) => {
        return await client.user.findUnique({
          where: { id: userId },
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            phone: true,
            createdAt: true,
            updatedAt: true
          }
        });
      });

      exportData.data.user = user;

      // Get children data if childId specified
      if (childId) {
        const child = await safePrismaQuery(async (client) => {
          return await client.child.findUnique({
            where: { id: childId },
            include: {
              permissions: true,
              bookings: {
                include: {
                  activity: {
                    select: {
                      title: true,
                      description: true,
                      startDate: true,
                      endDate: true
                    }
                  }
                }
              }
            }
          });
        });

        exportData.data.child = child;
      }

      // Get bookings
      const bookings = await safePrismaQuery(async (client) => {
        return await client.booking.findMany({
          where: {
            parentId: userId,
            ...(childId && { childId })
          },
          include: {
            activity: {
              select: {
                title: true,
                description: true,
                startDate: true,
                endDate: true
              }
            },
            child: {
              select: {
                firstName: true,
                lastName: true
              }
            }
          }
        });
      });

      exportData.data.bookings = bookings;

      // Audit the data export
      await this.auditDataAccess(
        userId,
        childId || 'all',
        ['user_data', 'child_data', 'booking_data'],
        'data_export',
        'system'
      );

      logger.info(`Data export generated for user ${userId}`, {
        childId,
        dataTypes: Object.keys(exportData.data)
      });

      return exportData;
    } catch (error) {
      logger.error('Error generating data export:', error);
      throw error;
    }
  }
}

