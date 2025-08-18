require('dotenv').config();
const FormData = require("form-data"); // form-data v4.0.1
const Mailgun = require("mailgun.js"); // mailgun.js v11.1.0

async function sendEmail(to, subject, text) {
  const mailgun = new Mailgun(FormData);
  const mg = mailgun.client({
    username: "api",
    key: process.env.MAILGUN_API_KEY || "API_KEY",
    // When you have an EU-domain, you must specify the endpoint:
    // url: "https://api.eu.mailgun.net"
  });
  try {
    const data = await mg.messages.create("mail-testing.bschoolland.com", {
      from: "Mailgun Sandbox <postmaster@mail-testing.bschoolland.com>",
      to: [to],
      subject: subject,
      text: text,
    });

    console.log(data); // logs response data
  } catch (error) {
    console.log(error); //logs any error
  }
}

async function sendLeadsEmail(to, projectsData) {
    const subject = `Leads Scrape: ${projectsData.length} new leads scraped`;
    const text = `
    ${projectsData.map(project => `
        ${project.project_name}
        ${project.project_data}
    `).join('\n')}
    TODO: Make this more readable
    `;
    await sendEmail(to, subject, text);
}



module.exports = {
    sendLeadsEmail
}