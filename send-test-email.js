#!/usr/bin/env node

// Test script to send actual email to bschoolland@gmail.com
require('dotenv').config({ path: './server/.env' }); // Load env from server directory
const { sendScheduledLeadsEmail } = require('./server/services/send-mail');

// Sample project data for testing
const sampleProjects = [
    {
        id: 1,
        'Project Name': 'Test School Construction Project',
        'Address': '123 Test St, Sacramento, CA 95814',
        'Estimated Amt': '$3,500,000',
        'Received Date': '2024-01-15',
        'Project Type': 'New Construction',
        'Project Scope': 'Elementary School Construction',
        'City': 'Sacramento',
        'Project Class': 'K-12',
        'PTN #': 'TEST-001',
        'Office ID': 'SAC-01',
        category: 'strongLeads'
    },
    {
        id: 2,
        'Project Name': 'Community Center Renovation',
        'Address': '456 Community Ave, Davis, CA 95616',
        'Estimated Amt': '$1,250,000',
        'Received Date': '2024-01-12',
        'Project Type': 'Renovation',
        'Project Scope': 'HVAC and Electrical Upgrades',
        'City': 'Davis',
        'Project Class': 'Community',
        'PTN #': 'TEST-002',
        'Office ID': 'DAV-01',
        category: 'weakLeads'
    }
];

async function sendTestEmail() {
    console.log('Sending test email to bschoolland@gmail.com...');
    
    try {
        const testEmail = 'bschoolland@gmail.com';
        const totalNewProjects = 15; // Simulating 15 total new projects found
        const leadType = 'strongLeads';
        
        console.log(`Test data: ${sampleProjects.length} qualifying projects out of ${totalNewProjects} total`);
        
        await sendScheduledLeadsEmail(testEmail, totalNewProjects, sampleProjects, leadType);
        console.log('✅ Test email sent successfully!');
        
    } catch (error) {
        console.error('❌ Failed to send test email:', error.message);
        if (error.status) {
            console.log(`Status: ${error.status}`);
        }
    }
}

sendTestEmail();
