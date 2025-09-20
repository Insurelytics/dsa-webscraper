#!/usr/bin/env node

require('dotenv').config();

const { initDatabase } = require('./database/init');
const { processAllJobs } = require('./services/schedule');

(async () => {
    try {
        await initDatabase();
        console.log('Database initialized. Triggering pipeline now...');
        await processAllJobs();
        console.log('Pipeline completed.');
        process.exit(0);
    } catch (err) {
        console.error('Pipeline failed:', err);
        process.exit(1);
    }
})();


