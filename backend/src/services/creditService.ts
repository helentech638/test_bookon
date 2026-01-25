import { db } from '../utils/database';
import { logger } from '../utils/logger';
import { AppError } from '../middleware/errorHandler';
import { 
  CreditTransaction, 
  ParentWallet, 
  CreditRequest,
  CreditCalculation
} from '../types/refundCredit';

export class CreditService {
  private static readonly DEFAULT_EXPIRY_MONTHS = 12;

  /**
   * Get parent's wallet with all credits and recent transactions
   */
  static async getParentWallet(parentId: string): Promise<ParentWallet> {
    try {
      // Get all active credits
      const credits = await db('wallet_credits')
        .where({ parentId, status: 'active' })
        .orderBy('createdAt', 'desc');

      // Get recent refund transactions
      const recentTransactions = await db('refund_transactions')
        .where({ parentId })
        .orderBy('createdAt', 'desc')
        .limit(10);

      // Calculate totals
      const totalCredits = credits.reduce((sum, credit) => sum + parseFloat(credit.amount), 0);
      const usedCredits = credits.reduce((sum, credit) => sum + parseFloat(credit.usedAmount), 0);
      const availableCredits = totalCredits - usedCredits;
      
      // Calculate expired credits
      const now = new Date();
      const expiredCredits = credits
        .filter(credit => new Date(credit.expiryDate) < now)
        .reduce((sum, credit) => sum + parseFloat(credit.amount), 0);

      return {
        parentId,
        totalCredits,
        availableCredits,
        usedCredits,
        expiredCredits,
        credits: credits.map(credit => ({
          id: credit.id,
          parentId: credit.parentId,
          amount: parseFloat(credit.amount),
          usedAmount: parseFloat(credit.usedAmount),
          remainingAmount: parseFloat(credit.amount) - parseFloat(credit.usedAmount),
          source: credit.source,
          description: credit.description,
          status: credit.status,
          expiryDate: new Date(credit.expiryDate),
          bookingId: credit.bookingId,
          createdAt: new Date(credit.createdAt),
          updatedAt: new Date(credit.updatedAt),
          usedAt: credit.usedAt ? new Date(credit.usedAt) : undefined
        })),
        recentTransactions: recentTransactions.map(transaction => ({
          id: transaction.id,
          bookingId: transaction.bookingId,
          parentId: transaction.parentId,
          amount: parseFloat(transaction.amount),
          adminFee: parseFloat(transaction.adminFee),
          netAmount: parseFloat(transaction.netAmount),
          method: transaction.method,
          reason: transaction.reason,
          status: transaction.status,
          stripeRefundId: transaction.stripeRefundId,
          processedAt: transaction.processedAt ? new Date(transaction.processedAt) : undefined,
          adminId: transaction.adminId,
          createdAt: new Date(transaction.createdAt),
          updatedAt: new Date(transaction.updatedAt)
        }))
      };
    } catch (error) {
      logger.error('Error getting parent wallet:', error);
      throw error;
    }
  }

  /**
   * Issue credit to parent wallet
   */
  static async issueCredit(request: CreditRequest): Promise<string> {
    try {
      const expiryDate = new Date();
      expiryDate.setMonth(expiryDate.getMonth() + (request.expiryMonths || this.DEFAULT_EXPIRY_MONTHS));

      const creditData = {
        parentId: request.parentId,
        amount: request.amount,
        usedAmount: 0,
        expiryDate,
        source: request.source,
        status: 'active',
        description: request.reason,
        bookingId: request.bookingId,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const [credit] = await db('wallet_credits')
        .insert(creditData)
        .returning('*');

      // Update parent's credit balance
      await db('users')
        .where({ id: request.parentId })
        .increment('creditBalance', request.amount);

      logger.info(`Credit issued: ${credit.id} for parent: ${request.parentId}, amount: ${request.amount}`);
      return credit.id;
    } catch (error) {
      logger.error('Error issuing credit:', error);
      throw error;
    }
  }

  /**
   * Use credit for a booking
   */
  static async useCredit(
    parentId: string, 
    amount: number, 
    bookingId: string,
    description: string = 'Credit applied to booking'
  ): Promise<{ usedCredits: CreditTransaction[], remainingAmount: number }> {
    try {
      if (amount <= 0) {
        throw new AppError('Credit amount must be positive', 400, 'INVALID_CREDIT_AMOUNT');
      }

      // Get available credits (oldest first - FIFO)
      const availableCredits = await db('wallet_credits')
        .where({ 
          parentId, 
          status: 'active'
        })
        .where('amount', '>', db.raw('usedAmount'))
        .where('expiryDate', '>', new Date())
        .orderBy('createdAt', 'asc');

      if (availableCredits.length === 0) {
        throw new AppError('No available credits', 400, 'NO_AVAILABLE_CREDITS');
      }

      let remainingAmount = amount;
      const usedCredits: CreditTransaction[] = [];

      // Use credits in FIFO order
      for (const credit of availableCredits) {
        if (remainingAmount <= 0) break;

        const availableAmount = parseFloat(credit.amount) - parseFloat(credit.usedAmount);
        const useAmount = Math.min(remainingAmount, availableAmount);

        if (useAmount > 0) {
          // Update credit usage
          await db('wallet_credits')
            .where({ id: credit.id })
            .update({
              usedAmount: db.raw('usedAmount + ?', [useAmount]),
              usedAt: new Date(),
              updatedAt: new Date()
            });

          // Check if credit is fully used
          const newUsedAmount = parseFloat(credit.usedAmount) + useAmount;
          if (newUsedAmount >= parseFloat(credit.amount)) {
            await db('wallet_credits')
              .where({ id: credit.id })
              .update({ status: 'used' });
          }

          usedCredits.push({
            id: credit.id,
            parentId: credit.parentId,
            amount: parseFloat(credit.amount),
            usedAmount: newUsedAmount,
            remainingAmount: parseFloat(credit.amount) - newUsedAmount,
            source: credit.source,
            description: credit.description,
            status: newUsedAmount >= parseFloat(credit.amount) ? 'used' : 'active',
            expiryDate: new Date(credit.expiryDate),
            bookingId: credit.bookingId,
            createdAt: new Date(credit.createdAt),
            updatedAt: new Date(),
            usedAt: new Date()
          });

          remainingAmount -= useAmount;
        }
      }

      // Update parent's credit balance
      await db('users')
        .where({ id: parentId })
        .decrement('creditBalance', amount - remainingAmount);

      logger.info(`Credits used: ${amount - remainingAmount} for parent: ${parentId}, booking: ${bookingId}`);
      
      return { usedCredits, remainingAmount };
    } catch (error) {
      logger.error('Error using credit:', error);
      throw error;
    }
  }

  /**
   * Calculate credit amount for cancellation
   */
  static calculateCreditAmount(
    originalAmount: number,
    adminFee: number = 0,
    reason: string,
    source: 'cancellation' | 'admin_override' | 'refund_conversion'
  ): CreditCalculation {
    const creditAmount = originalAmount - adminFee;
    const expiryDate = new Date();
    expiryDate.setMonth(expiryDate.getMonth() + this.DEFAULT_EXPIRY_MONTHS);

    return {
      originalAmount,
      creditAmount,
      adminFee,
      reason,
      expiryDate,
      source
    };
  }

  /**
   * Get credit transaction by ID
   */
  static async getCreditTransaction(id: string): Promise<CreditTransaction | null> {
    try {
      const credit = await db('wallet_credits')
        .where({ id })
        .first();

      if (!credit) return null;

      return {
        id: credit.id,
        parentId: credit.parentId,
        amount: parseFloat(credit.amount),
        usedAmount: parseFloat(credit.usedAmount),
        remainingAmount: parseFloat(credit.amount) - parseFloat(credit.usedAmount),
        source: credit.source,
        description: credit.description,
        status: credit.status,
        expiryDate: new Date(credit.expiryDate),
        bookingId: credit.bookingId,
        createdAt: new Date(credit.createdAt),
        updatedAt: new Date(credit.updatedAt),
        usedAt: credit.usedAt ? new Date(credit.usedAt) : undefined
      };
    } catch (error) {
      logger.error('Error getting credit transaction:', error);
      throw error;
    }
  }

  /**
   * Get credit transactions for a parent
   */
  static async getParentCredits(
    parentId: string,
    page: number = 1,
    limit: number = 20,
    status?: string
  ): Promise<{ credits: CreditTransaction[], total: number }> {
    try {
      const offset = (page - 1) * limit;
      let query = db('wallet_credits').where({ parentId });

      if (status) {
        query = query.where({ status });
      }

      const credits = await query
        .orderBy('createdAt', 'desc')
        .limit(limit)
        .offset(offset);

      const total = await query.clone().count('* as count').first();

      return {
        credits: credits.map(credit => ({
          id: credit.id,
          parentId: credit.parentId,
          amount: parseFloat(credit.amount),
          usedAmount: parseFloat(credit.usedAmount),
          remainingAmount: parseFloat(credit.amount) - parseFloat(credit.usedAmount),
          source: credit.source,
          description: credit.description,
          status: credit.status,
          expiryDate: new Date(credit.expiryDate),
          bookingId: credit.bookingId,
          createdAt: new Date(credit.createdAt),
          updatedAt: new Date(credit.updatedAt),
          usedAt: credit.usedAt ? new Date(credit.usedAt) : undefined
        })),
        total: parseInt(total?.count as string) || 0
      };
    } catch (error) {
      logger.error('Error getting parent credits:', error);
      throw error;
    }
  }

  /**
   * Cancel/expire credit
   */
  static async cancelCredit(creditId: string, reason: string): Promise<void> {
    try {
      const credit = await db('wallet_credits')
        .where({ id: creditId })
        .first();

      if (!credit) {
        throw new AppError('Credit not found', 404, 'CREDIT_NOT_FOUND');
      }

      const remainingAmount = parseFloat(credit.amount) - parseFloat(credit.usedAmount);

      await db.transaction(async (trx) => {
        // Update credit status
        await trx('wallet_credits')
          .where({ id: creditId })
          .update({
            status: 'cancelled',
            description: `${credit.description} - Cancelled: ${reason}`,
            updatedAt: new Date()
          });

        // Update parent's credit balance
        await trx('users')
          .where({ id: credit.parentId })
          .decrement('creditBalance', remainingAmount);
      });

      logger.info(`Credit cancelled: ${creditId}, reason: ${reason}`);
    } catch (error) {
      logger.error('Error cancelling credit:', error);
      throw error;
    }
  }

  /**
   * Check for expired credits and update their status
   */
  static async processExpiredCredits(): Promise<number> {
    try {
      const now = new Date();
      
      const expiredCredits = await db('wallet_credits')
        .where({ status: 'active' })
        .where('expiryDate', '<', now);

      let processedCount = 0;

      for (const credit of expiredCredits) {
        const remainingAmount = parseFloat(credit.amount) - parseFloat(credit.usedAmount);
        
        await db.transaction(async (trx) => {
          // Update credit status
          await trx('wallet_credits')
            .where({ id: credit.id })
            .update({
              status: 'expired',
              description: `${credit.description} - Expired`,
              updatedAt: new Date()
            });

          // Update parent's credit balance
          await trx('users')
            .where({ id: credit.parentId })
            .decrement('creditBalance', remainingAmount);
        });

        processedCount++;
      }

      logger.info(`Processed ${processedCount} expired credits`);
      return processedCount;
    } catch (error) {
      logger.error('Error processing expired credits:', error);
      throw error;
    }
  }

  /**
   * Get credit statistics for admin dashboard
   */
  static async getCreditStats(venueId?: string): Promise<{
    totalCredits: number;
    activeCredits: number;
    usedCredits: number;
    expiredCredits: number;
    totalValue: number;
    activeValue: number;
    usedValue: number;
    expiredValue: number;
  }> {
    try {
      let query = db('wallet_credits');
      
      if (venueId) {
        query = query.join('bookings', 'wallet_credits.bookingId', 'bookings.id')
          .join('activities', 'bookings.activityId', 'activities.id')
          .where('activities.venueId', venueId);
      }

      const credits = await query.select('*');

      const stats = {
        totalCredits: credits.length,
        activeCredits: 0,
        usedCredits: 0,
        expiredCredits: 0,
        totalValue: 0,
        activeValue: 0,
        usedValue: 0,
        expiredValue: 0
      };

      credits.forEach(credit => {
        const amount = parseFloat(credit.amount);
        const usedAmount = parseFloat(credit.usedAmount);
        const remainingAmount = amount - usedAmount;

        stats.totalValue += amount;
        stats.usedValue += usedAmount;

        switch (credit.status) {
          case 'active':
            stats.activeCredits++;
            stats.activeValue += remainingAmount;
            break;
          case 'used':
            stats.usedCredits++;
            break;
          case 'expired':
            stats.expiredCredits++;
            stats.expiredValue += remainingAmount;
            break;
        }
      });

      return stats;
    } catch (error) {
      logger.error('Error getting credit stats:', error);
      throw error;
    }
  }
}



