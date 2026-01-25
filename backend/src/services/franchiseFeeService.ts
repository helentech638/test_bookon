import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface FranchiseFeeConfig {
  id: string;
  businessAccountId: string;
  franchiseFeeType: 'percent' | 'fixed';
  franchiseFeeValue: number;
  vatMode: 'inclusive' | 'exclusive';
  adminFeeAmount?: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface VenueFranchiseFeeOverride {
  venueId: string;
  inheritFranchiseFee: boolean;
  franchiseFeeType?: 'percent' | 'fixed';
  franchiseFeeValue?: number;
}

export class FranchiseFeeService {
  /**
   * Get franchise fee configuration for a business account (using User entity)
   */
  static async getFranchiseFeeConfig(businessAccountId: string): Promise<FranchiseFeeConfig | null> {
    try {
      const businessUser = await prisma.user.findFirst({
        where: { 
          id: businessAccountId,
          role: 'business'
        },
        select: {
          id: true,
          franchiseFeeType: true,
          franchiseFeeValue: true,
          vatMode: true,
          adminFeeAmount: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      if (!businessUser) {
        return null;
      }

      return {
        id: businessUser.id,
        businessAccountId: businessUser.id,
        franchiseFeeType: businessUser.franchiseFeeType as 'percent' | 'fixed',
        franchiseFeeValue: businessUser.franchiseFeeValue ? Number(businessUser.franchiseFeeValue) : 0,
        vatMode: businessUser.vatMode as 'inclusive' | 'exclusive',
        adminFeeAmount: businessUser.adminFeeAmount ? Number(businessUser.adminFeeAmount) : undefined,
        isActive: businessUser.isActive,
        createdAt: businessUser.createdAt,
        updatedAt: businessUser.updatedAt,
      };
    } catch (error) {
      console.error('Error getting franchise fee config:', error);
      throw new Error('Failed to get franchise fee configuration');
    }
  }

  /**
   * Update franchise fee configuration for a business account (using User entity)
   */
  static async updateFranchiseFeeConfig(
    businessAccountId: string,
    config: {
      franchiseFeeType: 'percent' | 'fixed';
      franchiseFeeValue: number;
      vatMode: 'inclusive' | 'exclusive';
      adminFeeAmount?: number;
    }
  ): Promise<FranchiseFeeConfig> {
    try {
      const updatedUser = await prisma.user.update({
        where: { 
          id: businessAccountId,
          role: 'business'
        },
        data: {
          franchiseFeeType: config.franchiseFeeType,
          franchiseFeeValue: config.franchiseFeeValue,
          vatMode: config.vatMode,
          adminFeeAmount: config.adminFeeAmount,
          updatedAt: new Date(),
        },
      });

      return {
        id: updatedUser.id,
        businessAccountId: updatedUser.id,
        franchiseFeeType: updatedUser.franchiseFeeType as 'percent' | 'fixed',
        franchiseFeeValue: updatedUser.franchiseFeeValue ? Number(updatedUser.franchiseFeeValue) : 0,
        vatMode: updatedUser.vatMode as 'inclusive' | 'exclusive',
        adminFeeAmount: updatedUser.adminFeeAmount ? Number(updatedUser.adminFeeAmount) : undefined,
        isActive: updatedUser.isActive,
        createdAt: updatedUser.createdAt,
        updatedAt: updatedUser.updatedAt,
      };
    } catch (error) {
      console.error('Error updating franchise fee config:', error);
      throw new Error('Failed to update franchise fee configuration');
    }
  }

  /**
   * Get venue franchise fee override
   */
  static async getVenueFranchiseFeeOverride(venueId: string): Promise<VenueFranchiseFeeOverride | null> {
    try {
      const venue = await prisma.venue.findUnique({
        where: { id: venueId },
        select: {
          id: true,
          inheritFranchiseFee: true,
          franchiseFeeType: true,
          franchiseFeeValue: true,
        },
      });

      if (!venue) {
        return null;
      }

      return {
        venueId: venue.id,
        inheritFranchiseFee: venue.inheritFranchiseFee,
        franchiseFeeType: venue.franchiseFeeType as 'percent' | 'fixed' | undefined,
        franchiseFeeValue: venue.franchiseFeeValue ? Number(venue.franchiseFeeValue) : undefined,
      };
    } catch (error) {
      console.error('Error getting venue franchise fee override:', error);
      throw new Error('Failed to get venue franchise fee override');
    }
  }

  /**
   * Update venue franchise fee override
   */
  static async updateVenueFranchiseFeeOverride(
    venueId: string,
    override: {
      inheritFranchiseFee: boolean;
      franchiseFeeType?: 'percent' | 'fixed';
      franchiseFeeValue?: number;
    }
  ): Promise<VenueFranchiseFeeOverride> {
    try {
      const updatedVenue = await prisma.venue.update({
        where: { id: venueId },
        data: {
          inheritFranchiseFee: override.inheritFranchiseFee,
          franchiseFeeType: override.franchiseFeeType,
          franchiseFeeValue: override.franchiseFeeValue,
          updatedAt: new Date(),
        },
      });

      return {
        venueId: updatedVenue.id,
        inheritFranchiseFee: updatedVenue.inheritFranchiseFee,
        franchiseFeeType: updatedVenue.franchiseFeeType as 'percent' | 'fixed' | undefined,
        franchiseFeeValue: updatedVenue.franchiseFeeValue ? Number(updatedVenue.franchiseFeeValue) : undefined,
      };
    } catch (error) {
      console.error('Error updating venue franchise fee override:', error);
      throw new Error('Failed to update venue franchise fee override');
    }
  }

  /**
   * Calculate effective franchise fee for a venue
   */
  static async calculateEffectiveFranchiseFee(
    venueId: string,
    amount: number
  ): Promise<{
    franchiseFeeType: 'percent' | 'fixed';
    franchiseFeeValue: number;
    vatMode: 'inclusive' | 'exclusive';
    adminFeeAmount?: number;
    calculatedFee: number;
    breakdown: {
      grossAmount: number;
      franchiseFee: number;
      vatAmount: number;
      adminFee: number;
      netAmount: number;
    };
  }> {
    try {
      const venue = await prisma.venue.findUnique({
        where: { id: venueId },
        include: {
          owner: {
            select: {
              id: true,
              franchiseFeeType: true,
              franchiseFeeValue: true,
              vatMode: true,
              adminFeeAmount: true
            }
          }
        },
      });

      if (!venue || !venue.owner) {
        throw new Error('Venue or business owner not found');
      }

      let franchiseFeeType: 'percent' | 'fixed';
      let franchiseFeeValue: number;
      let vatMode: 'inclusive' | 'exclusive';
      let adminFeeAmount: number | undefined;

      if (venue.inheritFranchiseFee) {
        // Use business account (owner) settings
        franchiseFeeType = venue.owner.franchiseFeeType as 'percent' | 'fixed';
        franchiseFeeValue = venue.owner.franchiseFeeValue ? Number(venue.owner.franchiseFeeValue) : 0;
        vatMode = venue.owner.vatMode as 'inclusive' | 'exclusive';
        adminFeeAmount = venue.owner.adminFeeAmount ? Number(venue.owner.adminFeeAmount) : undefined;
      } else {
        // Use venue override settings
        franchiseFeeType = venue.franchiseFeeType as 'percent' | 'fixed';
        franchiseFeeValue = Number(venue.franchiseFeeValue || 0);
        vatMode = venue.owner.vatMode as 'inclusive' | 'exclusive'; // VAT mode always from business account
        adminFeeAmount = venue.owner.adminFeeAmount ? Number(venue.owner.adminFeeAmount) : undefined;
      }

      // Calculate franchise fee
      let franchiseFee = 0;
      if (franchiseFeeType === 'percent') {
        franchiseFee = Math.round((amount * franchiseFeeValue) / 100);
      } else {
        franchiseFee = franchiseFeeValue;
      }

      // Calculate VAT (20% UK rate)
      const vatRate = 0.20;
      let vatAmount = 0;
      let netFranchiseFee = 0;

      if (vatMode === 'inclusive') {
        // VAT is included in the franchise fee
        vatAmount = Math.round(franchiseFee * vatRate / (1 + vatRate));
        netFranchiseFee = franchiseFee - vatAmount;
      } else {
        // VAT is added on top of the franchise fee
        vatAmount = Math.round(franchiseFee * vatRate);
        netFranchiseFee = franchiseFee;
      }

      const adminFee = adminFeeAmount || 0;
      const netAmount = amount - franchiseFee - adminFee;

      return {
        franchiseFeeType,
        franchiseFeeValue,
        vatMode,
        adminFeeAmount,
        calculatedFee: franchiseFee,
        breakdown: {
          grossAmount: amount,
          franchiseFee: franchiseFee,
          vatAmount: vatAmount,
          adminFee: adminFee,
          netAmount: netAmount,
        },
      };
    } catch (error) {
      console.error('Error calculating effective franchise fee:', error);
      throw new Error('Failed to calculate effective franchise fee');
    }
  }

  /**
   * Get all franchise fee configurations (using User entities)
   */
  static async getAllFranchiseFeeConfigs(): Promise<FranchiseFeeConfig[]> {
    try {
      const businessUsers = await prisma.user.findMany({
        where: { 
          isActive: true,
          role: 'business'
        },
        select: {
          id: true,
          businessName: true,
          firstName: true,
          lastName: true,
          franchiseFeeType: true,
          franchiseFeeValue: true,
          vatMode: true,
          adminFeeAmount: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { createdAt: 'desc' },
      });

      return businessUsers.map(user => ({
        id: user.id,
        businessAccountId: user.id,
        franchiseFeeType: user.franchiseFeeType as 'percent' | 'fixed',
        franchiseFeeValue: user.franchiseFeeValue ? Number(user.franchiseFeeValue) : 0,
        vatMode: user.vatMode as 'inclusive' | 'exclusive',
        adminFeeAmount: user.adminFeeAmount ? Number(user.adminFeeAmount) : undefined,
        isActive: user.isActive,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      }));
    } catch (error) {
      console.error('Error getting all franchise fee configs:', error);
      throw new Error('Failed to get franchise fee configurations');
    }
  }
}

export default FranchiseFeeService;
