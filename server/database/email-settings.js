const { db } = require('./init');

function getEmailSettings() {
    return new Promise((resolve, reject) => {
        db.get(`SELECT emails, frequency, lead_type, weekly_day, monthly_day, last_job_run FROM email_settings ORDER BY updated_at DESC LIMIT 1`, (err, row) => {
            if (err) {
                reject(err);
                return;
            }
            
            // If no settings exist, return defaults
            if (!row) {
                resolve({
                    emails: "",
                    frequency: "weekly",
                    leadType: "strong",
                    weeklyDay: "monday",
                    monthlyDay: 1
                });
                return;
            }
            
            resolve({
                emails: row.emails,
                frequency: row.frequency,
                leadType: row.lead_type,
                weeklyDay: row.weekly_day,
                monthlyDay: row.monthly_day,
                lastJobRun: row.last_job_run
            });
        });
    });
}

function updateEmailSettings(settings) {
    return new Promise(async (resolve, reject) => {
        const { emails, frequency, leadType, weeklyDay, monthlyDay } = settings;
        // keep existing last_job_run
        const existingSettings = await getEmailSettings(); // this is a promise
        const lastJobRun = existingSettings.lastJobRun;
        
        // Clear existing settings and insert new ones (simple approach for single user system)
        db.run(`DELETE FROM email_settings`, (err) => {
            if (err) {
                reject(err);
                return;
            }
            
            db.run(`
                INSERT INTO email_settings (emails, frequency, lead_type, weekly_day, monthly_day, updated_at, last_job_run)
                VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?)
            `, [emails, frequency, leadType, weeklyDay, monthlyDay, lastJobRun], (err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    });
}

function updateLastJobRun(lastJobRun) {
    return new Promise((resolve, reject) => {
        db.run(`UPDATE email_settings SET last_job_run = ? WHERE id = (SELECT id FROM email_settings ORDER BY updated_at DESC LIMIT 1)`, [lastJobRun], (err) => {
            if (err) reject(err);
            else resolve();
        });
    });
}

module.exports = {
    getEmailSettings,
    updateEmailSettings,
    updateLastJobRun
};

