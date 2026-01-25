import Holidays from 'date-holidays';

export interface HolidayInfo {
  date: string;
  name: string;
  type: string;
}

export class HolidayService {
  private holidays: Holidays;

  constructor() {
    this.holidays = new Holidays();
    // Set to UK holidays
    this.holidays.init('GB');
  }

  /**
   * Check if a given date is a UK bank holiday
   */
  isBankHoliday(date: Date): boolean {
    const holiday = this.holidays.isHoliday(date);
    return holiday !== false;
  }

  /**
   * Get all UK bank holidays for a given year
   */
  getBankHolidays(year: number): HolidayInfo[] {
    const holidays = this.holidays.getHolidays(year);
    return holidays.map(holiday => ({
      date: holiday.date,
      name: holiday.name,
      type: holiday.type
    }));
  }

  /**
   * Get all UK bank holidays between two dates
   */
  getBankHolidaysBetween(startDate: Date, endDate: Date): HolidayInfo[] {
    const holidays: HolidayInfo[] = [];
    const currentYear = startDate.getFullYear();
    const endYear = endDate.getFullYear();

    for (let year = currentYear; year <= endYear; year++) {
      const yearHolidays = this.getBankHolidays(year);
      holidays.push(...yearHolidays);
    }

    return holidays.filter(holiday => {
      const holidayDate = new Date(holiday.date);
      return holidayDate >= startDate && holidayDate <= endDate;
    });
  }

  /**
   * Check if a date should be excluded from session generation
   */
  shouldExcludeDate(date: Date, excludeBankHolidays: boolean, manuallyExcludedDates: string[]): boolean {
    const dateString = date.toISOString().split('T')[0];
    
    // Check if manually excluded
    if (dateString && manuallyExcludedDates.includes(dateString)) {
      return true;
    }

    // Check if it's a bank holiday and should be excluded
    if (excludeBankHolidays && this.isBankHoliday(date)) {
      return true;
    }

    return false;
  }

  /**
   * Get suggested dates to exclude (bank holidays) for a course
   */
  getSuggestedExclusions(startDate: Date, endDate: Date): string[] {
    const bankHolidays = this.getBankHolidaysBetween(startDate, endDate);
    return bankHolidays.map(holiday => holiday.date);
  }
}

export const holidayService = new HolidayService();

