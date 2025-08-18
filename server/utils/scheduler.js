const { getEmailSettings } = require('../database/email-settings');
const { getEnabledCounties } = require('../database/counties');
const { createScrapingJob } = require('../database/jobs');

/**
 * Get current date - can be overridden for testing via TEST_CURRENT_DATE env var
 * @returns {Date} - Current date or test date
 */
function getCurrentDate() {
    if (process.env.TEST_CURRENT_DATE) {
        const testDate = new Date(process.env.TEST_CURRENT_DATE);
        if (isNaN(testDate.getTime())) {
            console.warn(`Invalid TEST_CURRENT_DATE: ${process.env.TEST_CURRENT_DATE}, using real current date`);
            return new Date();
        }
        return testDate;
    }
    return new Date();
}

/**
 * Calculate the next scheduled time based on email settings
 * @param {Object} settings - Email settings object
 * @returns {Date} - Next scheduled date at 4am
 */
function calculateNextScheduledTime(settings) {
    const now = getCurrentDate();
    const { frequency, weeklyDay, monthlyDay } = settings;
    
    if (frequency === 'weekly') {
        return calculateNextWeeklyTime(now, weeklyDay);
    } else if (frequency === 'monthly') {
        return calculateNextMonthlyTime(now, monthlyDay);
    }
    
    throw new Error(`Unsupported frequency: ${frequency}`);
}

/**
 * Calculate next weekly scheduled time
 * @param {Date} now - Current date
 * @param {string} weeklyDay - Day of week (monday, tuesday, etc.)
 * @returns {Date} - Next scheduled date
 */
function calculateNextWeeklyTime(now, weeklyDay) {
    const dayMap = {
        'sunday': 0, 'monday': 1, 'tuesday': 2, 'wednesday': 3,
        'thursday': 4, 'friday': 5, 'saturday': 6
    };
    
    const targetDay = dayMap[weeklyDay.toLowerCase()];
    if (targetDay === undefined) {
        throw new Error(`Invalid weekly day: ${weeklyDay}`);
    }
    
    const nextDate = new Date(now);
    nextDate.setHours(4, 0, 0, 0); // Set to 4:00 AM
    
    // Calculate days until target day
    const currentDay = now.getDay();
    let daysUntilTarget = targetDay - currentDay;
    
    // If target day is today but time has passed, or target day is in the past, go to next week
    if (daysUntilTarget < 0 || (daysUntilTarget === 0 && now.getHours() >= 4)) {
        daysUntilTarget += 7;
    }
    
    nextDate.setDate(nextDate.getDate() + daysUntilTarget);
    return nextDate;
}

/**
 * Calculate next monthly scheduled time with edge case handling
 * @param {Date} now - Current date
 * @param {number} monthlyDay - Day of month (1-31)
 * @returns {Date} - Next scheduled date
 */
function calculateNextMonthlyTime(now, monthlyDay) {
    if (monthlyDay < 1 || monthlyDay > 31) {
        throw new Error(`Invalid monthly day: ${monthlyDay}`);
    }
    
    const nextDate = new Date(now);
    nextDate.setHours(4, 0, 0, 0); // Set to 4:00 AM
    
    // Start with current month
    let targetMonth = now.getMonth();
    let targetYear = now.getFullYear();
    
    // If target day is today but time has passed, or target day is in the past, go to next month
    if (now.getDate() > monthlyDay || (now.getDate() === monthlyDay && now.getHours() >= 4)) {
        targetMonth++;
        if (targetMonth > 11) {
            targetMonth = 0;
            targetYear++;
        }
    }
    
    // Handle edge case: if target day doesn't exist in the month, use last day of month
    const targetDay = getValidDayForMonth(targetYear, targetMonth, monthlyDay);
    
    nextDate.setFullYear(targetYear, targetMonth, targetDay);
    return nextDate;
}

/**
 * Get valid day for month, handling edge cases like Feb 31st
 * @param {number} year - Target year
 * @param {number} month - Target month (0-11)
 * @param {number} requestedDay - Requested day of month
 * @returns {number} - Valid day for the month
 */
function getValidDayForMonth(year, month, requestedDay) {
    // Get last day of the target month
    const lastDayOfMonth = new Date(year, month + 1, 0).getDate();
    
    // If requested day is valid for this month, use it
    if (requestedDay <= lastDayOfMonth) {
        return requestedDay;
    }
    
    // Otherwise, use the last day of the month
    return lastDayOfMonth;
}

/**
 * Queue scraping jobs for all enabled counties
 * @returns {Promise<Array>} - Array of created job IDs
 */
async function queueAllEnabledCounties() {
    try {
        const enabledCounties = await getEnabledCounties();
        const jobIds = [];
        
        console.log(`Queuing automatic scraping for ${enabledCounties.length} enabled counties`);
        
        for (const county of enabledCounties) {
            try {
                const jobId = await createScrapingJob(county.code);
                jobIds.push({ countyCode: county.code, countyName: county.name, jobId });
                console.log(`Queued scraping job ${jobId} for ${county.name} (${county.code})`);
            } catch (error) {
                console.error(`Failed to queue job for county ${county.name} (${county.code}):`, error);
            }
        }
        
        return jobIds;
    } catch (error) {
        console.error('Error queuing counties for scraping:', error);
        throw error;
    }
}

/**
 * Get milliseconds until next scheduled time
 * @param {Object} settings - Email settings object
 * @returns {number} - Milliseconds until next scheduled time
 */
function getMillisecondsUntilNext(settings) {
    const nextTime = calculateNextScheduledTime(settings);
    const now = getCurrentDate();
    return nextTime.getTime() - now.getTime();
}

module.exports = {
    getCurrentDate,
    calculateNextScheduledTime,
    calculateNextWeeklyTime,
    calculateNextMonthlyTime,
    getValidDayForMonth,
    queueAllEnabledCounties,
    getMillisecondsUntilNext
};
