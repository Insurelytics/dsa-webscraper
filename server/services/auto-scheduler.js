const { getEmailSettings } = require('../database/email-settings');
const { 
    calculateNextScheduledTime, 
    queueAllEnabledCounties,
    getMillisecondsUntilNext 
} = require('../utils/scheduler');

class AutoScheduler {
    constructor() {
        this.timeoutId = null;
        this.isScheduled = false;
        this.lastScheduledTime = null;
    }

    /**
     * Start the auto-scheduler
     */
    async start() {
        try {
            console.log('Starting auto-scheduler...');
            await this.scheduleNext();
        } catch (error) {
            console.error('Error starting auto-scheduler:', error);
        }
    }

    /**
     * Stop the auto-scheduler
     */
    stop() {
        if (this.timeoutId) {
            clearTimeout(this.timeoutId);
            this.timeoutId = null;
            this.isScheduled = false;
            console.log('Auto-scheduler stopped');
        }
    }

    /**
     * Schedule the next scraping run based on email settings
     */
    async scheduleNext() {
        try {
            // Clear any existing timeout
            this.stop();

            // Get current email settings
            const settings = await getEmailSettings();
            
            // Only schedule if emails are configured (feature is enabled)
            if (!settings.emails || settings.emails.trim().length === 0) {
                console.log('Auto-scheduler: No emails configured, scheduling disabled');
                return;
            }

            // Calculate next scheduled time
            const nextTime = calculateNextScheduledTime(settings);
            const msUntilNext = getMillisecondsUntilNext(settings);
            
            this.lastScheduledTime = nextTime;
            
            console.log(`Auto-scheduler: Next run scheduled for ${nextTime.toISOString()} (${Math.round(msUntilNext / 1000 / 60 / 60)} hours from now)`);
            console.log(`Schedule: ${settings.frequency} on ${settings.frequency === 'weekly' ? settings.weeklyDay : `day ${settings.monthlyDay}`}`);

            // Schedule the next run
            this.timeoutId = setTimeout(async () => {
                await this.executeScheduledRun();
            }, msUntilNext);
            
            this.isScheduled = true;

        } catch (error) {
            console.error('Error scheduling next scraping run:', error);
            // Retry in 1 hour if there's an error
            this.timeoutId = setTimeout(() => {
                this.scheduleNext();
            }, 60 * 60 * 1000);
        }
    }

    /**
     * Execute the scheduled scraping run
     */
    async executeScheduledRun() {
        try {
            console.log('Auto-scheduler: Executing scheduled scraping run...');
            
            // Queue scraping jobs for all enabled counties
            const queuedJobs = await queueAllEnabledCounties();
            
            console.log(`Auto-scheduler: Successfully queued ${queuedJobs.length} scraping jobs`);
            queuedJobs.forEach(job => {
                console.log(`  - ${job.countyName} (${job.countyCode}): Job ID ${job.jobId}`);
            });

        } catch (error) {
            console.error('Error executing scheduled scraping run:', error);
        } finally {
            // Schedule the next run regardless of success/failure
            await this.scheduleNext();
        }
    }

    /**
     * Reschedule if settings have changed
     */
    async reschedule() {
        console.log('Auto-scheduler: Rescheduling due to settings change...');
        await this.scheduleNext();
    }

    /**
     * Get current scheduler status
     */
    getStatus() {
        return {
            isScheduled: this.isScheduled,
            lastScheduledTime: this.lastScheduledTime,
            nextRunAt: this.lastScheduledTime ? this.lastScheduledTime.toISOString() : null
        };
    }
}

// Create singleton instance
const autoScheduler = new AutoScheduler();

module.exports = autoScheduler;
