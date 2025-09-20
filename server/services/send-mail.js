require('dotenv').config();
const FormData = require("form-data"); // form-data v4.0.1
const Mailgun = require("mailgun.js"); // mailgun.js v11.1.0
const fs = require('fs');
const path = require('path');
const { generateProjectsExcel } = require('../../shared/excel-utils');
const mailDomain = 'jacob.simplarity.ai'

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
      from: "Jacob AI <jacob@" + mailDomain + ">",
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

    const data = await mg.messages.create(mailDomain, messageData);
    console.log(`Email sent successfully to ${to}`);
    return data;
  } catch (error) {
    console.error(`Failed to send email to ${to}:`, error);
    throw error;
  }
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

async function sendScheduledLeadsEmail(emailList, totalNewProjects, qualifiedProjects, leadType, durationMs = null) {
    const emails = emailList.split(',').map(email => email.trim()).filter(email => email);
    
    if (emails.length === 0) {
        console.log('No email addresses configured, skipping email');
        return;
    }

    const leadTypeName = leadType === 'strongLeads' ? 'Strong Leads' : 
                        leadType === 'weakLeads' ? 'Weak Leads' : 
                        leadType === 'watchlist' ? 'Watchlist' : leadType;

    // Generate and persist Excel to a permanent public location
    let downloadUrl = null;
    if (qualifiedProjects.length > 0) {
        const excelBuffer = generateProjectsExcel(qualifiedProjects);
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `dgs_${leadType}_${timestamp}.xlsx`;
        const reportsDir = path.join(__dirname, '..', 'public', 'reports');
        const filePath = path.join(reportsDir, filename);

        if (!fs.existsSync(reportsDir)) {
            fs.mkdirSync(reportsDir, { recursive: true });
        }
        fs.writeFileSync(filePath, excelBuffer);

        const baseUrl = process.env.PUBLIC_BASE_URL || 'http://localhost:8000';
        downloadUrl = `${baseUrl}/public/reports/${filename}`;
        console.log(`Report saved: ${filePath} -> ${downloadUrl}`);
    }

    const durationText = durationMs != null ? `${Math.round(durationMs / 1000)}s` : 'n/a';
    const subject = `Leads: ${qualifiedProjects.length} found`;
    const textContent = `Leads summary

Total new projects: ${totalNewProjects}
Qualified: ${qualifiedProjects.length}
Duration: ${durationText}
${downloadUrl ? `Download: ${downloadUrl}` : 'No qualifying projects this run.'}

This email was sent automatically.`;
    const htmlContent = `<!DOCTYPE html>
<html><body style="font-family: Arial, sans-serif; margin: 16px;">
<h3>Leads summary</h3>
<p><strong>Total new projects:</strong> ${totalNewProjects}</p>
<p><strong>Qualified (${leadTypeName}):</strong> ${qualifiedProjects.length}</p>
<p><strong>Duration:</strong> ${durationText}</p>
${downloadUrl ? `<p><a href="${downloadUrl}">Download Excel report</a></p>` : '<p>No qualifying projects this run.</p>'}
<hr/>
<p style="color:#666;font-size:12px;">This email was sent automatically.</p>
</body></html>`;

    // Send email to each address (no attachments)
    const emailPromises = emails.map(async (email) => {
        try {
            await sendEmail(email, subject, textContent, htmlContent, []);
            console.log(`Successfully sent email to ${email}`);
        } catch (error) {
            console.error(`Failed to send email to ${email}:`, error);
        }
    });

    await Promise.all(emailPromises);

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
    sendEmail
}