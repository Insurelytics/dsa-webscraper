require('dotenv').config();
const FormData = require("form-data"); // form-data v4.0.1
const Mailgun = require("mailgun.js"); // mailgun.js v11.1.0
const fs = require('fs');
const path = require('path');

async function sendEmail(to, subject, text, html = null, attachments = []) {
  const mailgun = new Mailgun(FormData);
  const mg = mailgun.client({
    username: "api",
    key: process.env.MAILGUN_API_KEY || "API_KEY",
    // When you have an EU-domain, you must specify the endpoint:
    // url: "https://api.eu.mailgun.net"
  });
  try {
    const messageData = {
      from: "Jacob AI <jacob@mail-testing.bschoolland.com>",
      to: [to],
      subject: subject,
      text: text,
    };

    if (html) {
      messageData.html = html;
    }

    // Add attachments if provided
    if (attachments && attachments.length > 0) {
      messageData.attachment = attachments;
    }

    const data = await mg.messages.create("mail-testing.bschoolland.com", messageData);
    console.log(`Email sent successfully to ${to}`);
    return data;
  } catch (error) {
    console.error(`Failed to send email to ${to}:`, error);
    throw error;
  }
}

function generateProjectsCSV(projects) {
    if (projects.length === 0) return '';
    
    // Get all unique keys from all projects to create comprehensive headers
    const allKeys = new Set();
    projects.forEach(project => {
        Object.keys(project).forEach(key => allKeys.add(key));
    });
    
    // Filter out columns that are completely empty or only contain empty strings
    const keysWithData = Array.from(allKeys).filter(key => {
        return projects.some(project => {
            const value = project[key];
            return value !== null && value !== undefined && value !== '' && String(value).trim() !== '';
        });
    });
    
    // Order the headers based on the sample CSV structure
    const orderedHeaders = [
        '# Of Incr', 'Address', 'Adj Est.Amt#1', 'Adj Est.Amt#2', 'Adj Est.Date#1', 'Adj Est.Date#2',
        'Application #', 'Approval Ext. Date', 'Approved Date', 'Auto Fire Detection', 'City',
        "Client's Notes", 'Climate Zone', 'Closed Date', 'Complete Submittal Received Date',
        'Construction Change Document Amt', 'Contracted Amt', 'EPR Approved Date', 'Energy Efficiency',
        'Energy Notes', 'Estimated Amt', 'File #', 'HPI', 'HPI Hours', 'HPI Points', 'Included In Plan',
        'OPSC #', 'Office ID', 'PTN #', 'Project Class', 'Project Name', 'Project Scope', 'Project Type',
        "Project's Sq.footage", 'Received Date', 'Required', 'Required review services', 'SB 575',
        'Special Type', 'Special review type', 'Sprinkler System', 'Zip'
    ];
    
    // Add any remaining keys that weren't in the ordered list, but only if they have data
    const remainingKeys = keysWithData.filter(key => !orderedHeaders.includes(key));
    const headers = [...orderedHeaders.filter(header => keysWithData.includes(header)), ...remainingKeys];
    
    // Create CSV content
    const csvContent = [
        headers.join(','),
        ...projects.map(project => 
            headers.map(header => {
                const value = project[header] || '';
                // Escape commas and quotes in CSV
                if (typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\n'))) {
                    return `"${value.replace(/"/g, '""')}"`;
                }
                return value;
            }).join(',')
        )
    ].join('\n');
    
    return csvContent;
}

function formatProjectSummary(project) {
    const { extractAmount } = require('../utils/dataUtils');
    const estimatedAmt = extractAmount(project['Estimated Amt']) || 0;
    const formattedAmt = estimatedAmt ? `$${estimatedAmt.toLocaleString()}` : 'N/A';
    
    return `• ${project['Project Name'] || 'Unnamed Project'}
  Address: ${project['Address'] || 'N/A'}
  Estimated Amount: ${formattedAmt}
  Received Date: ${project['Received Date'] || 'N/A'}
  Project Type: ${project['Project Type'] || 'N/A'}`;
}

async function sendScheduledLeadsEmail(emailList, totalNewProjects, qualifiedProjects, leadType) {
    const emails = emailList.split(',').map(email => email.trim()).filter(email => email);
    
    if (emails.length === 0) {
        console.log('No email addresses configured, skipping email');
        return;
    }

    const leadTypeName = leadType === 'strongLeads' ? 'Strong Leads' : 
                        leadType === 'weakLeads' ? 'Weak Leads' : 
                        leadType === 'watchlist' ? 'Watchlist' : leadType;
    
    const subject = `New Leads: ${qualifiedProjects.length} Projects Found that Meet your Criteria`;
    
    const textContent = `DSA Scraper Results

Total new projects found: ${totalNewProjects}
New projects that meet your criteria: ${qualifiedProjects.length}

${qualifiedProjects.length > 0 ? `Project Details:
${qualifiedProjects.map(formatProjectSummary).join('\n\n')}` : 'No projects matched your criteria this time.'}

${qualifiedProjects.length > 0 ? 'A detailed CSV file with all qualifying projects is attached.' : ''}

---
This email was sent automatically by your DGS Scraper system.`;

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin-bottom: 20px; }
        .stats { background-color: #e3f2fd; padding: 15px; border-radius: 5px; margin-bottom: 20px; }
        .project { background-color: #f5f5f5; padding: 15px; margin: 10px 0; border-radius: 5px; }
        .footer { margin-top: 30px; font-size: 12px; color: #666; }
    </style>
</head>
<body>
    <div class="header">
        <h2>DGS Scraper Results</h2>
    </div>
    
    <div class="stats">
        <h3>Summary</h3>
        <p><strong>Total new projects found:</strong> ${totalNewProjects}</p>
        <p><strong>New ${leadTypeName} that meet your criteria:</strong> ${qualifiedProjects.length}</p>
    </div>
    
    ${qualifiedProjects.length > 0 ? `
    <h3>Project Details:</h3>
    ${qualifiedProjects.map(project => {
        const { extractAmount } = require('../utils/dataUtils');
        const estimatedAmt = extractAmount(project['Estimated Amt']) || 0;
        const formattedAmt = estimatedAmt ? `$${estimatedAmt.toLocaleString()}` : 'N/A';
        
        return `<div class="project">
            <h4>${project['Project Name'] || 'Unnamed Project'}</h4>
            <p><strong>Address:</strong> ${project['Address'] || 'N/A'}</p>
            <p><strong>Estimated Amount:</strong> ${formattedAmt}</p>
            <p><strong>Received Date:</strong> ${project['Received Date'] || 'N/A'}</p>
            <p><strong>Project Type:</strong> ${project['Project Type'] || 'N/A'}</p>
        </div>`;
    }).join('')}
    
    <p><strong>A detailed CSV file with all qualifying projects is attached.</strong></p>
    ` : '<p>No projects matched your criteria this time.</p>'}
    
    <div class="footer">
        <p>This email was sent automatically by your DSA Scraper system.</p>
    </div>
</body>
</html>`;

    // Create CSV attachment if there are qualified projects
    let attachments = [];
    if (qualifiedProjects.length > 0) {
        const csvContent = generateProjectsCSV(qualifiedProjects);
        const filename = `dgs_${leadType}_${new Date().toISOString().split('T')[0]}.csv`;
        const tempFilePath = path.join(__dirname, '..', 'temp', filename);
        
        // Ensure temp directory exists
        const tempDir = path.dirname(tempFilePath);
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }
        
        // Write CSV to temp file
        fs.writeFileSync(tempFilePath, csvContent);
        
        // For mailgun.js, attachments need to be an array of file streams or buffers
        const fileStream = fs.createReadStream(tempFilePath);
        fileStream.filename = filename; // Set the filename property
        attachments = [fileStream];
    }

    // Send email to each address
    const emailPromises = emails.map(async (email) => {
        try {
            await sendEmail(email, subject, textContent, htmlContent, attachments);
            console.log(`Successfully sent email to ${email}`);
        } catch (error) {
            console.error(`Failed to send email to ${email}:`, error);
        }
    });

    await Promise.all(emailPromises);

    // Clean up temp files
    if (attachments.length > 0) {
        attachments.forEach(attachment => {
            try {
                fs.unlinkSync(attachment.path);
            } catch (error) {
                console.error('Error cleaning up temp file:', error);
            }
        });
    }

    console.log(`Email notifications sent to ${emails.length} recipients`);
}

// Keep old function for backward compatibility but mark as deprecated
async function sendLeadsEmail(to, projectsData) {
    console.warn('sendLeadsEmail is deprecated, use sendScheduledLeadsEmail instead');
    const subject = `Leads Scrape: ${projectsData.length} new leads scraped`;
    const text = `${projectsData.length} new projects found. This is a legacy email format.`;
    await sendEmail(to, subject, text);
}



module.exports = {
    sendLeadsEmail,
    sendScheduledLeadsEmail,
    sendEmail,
    generateProjectsCSV
}