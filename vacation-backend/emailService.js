const nodemailer = require('nodemailer');

const createTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: process.env.SMTP_PORT || 587,
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD,
    },
  });
};

const emailTemplates = {
  requestSubmitted: (employeeName, startDate, endDate, reason) => ({
    subject: 'Επιβεβαίωση Αίτησης Άδειας',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #4CAF50;">Η αίτηση άδειάς σας υποβλήθηκε επιτυχώς</h2>
        <p>Αγαπητέ/ή ${employeeName},</p>
        <p>Η αίτησή σας για άδεια έχει υποβληθεί και βρίσκεται σε αναμονή έγκρισης.</p>
        
        <div style="background-color: #f5f5f5; padding: 15px; margin: 20px 0; border-radius: 5px;">
          <h3 style="margin-top: 0;">Λεπτομέρειες Αίτησης:</h3>
          <p><strong>Ημερομηνία Έναρξης:</strong> ${new Date(startDate).toLocaleDateString('el-GR')}</p>
          <p><strong>Ημερομηνία Λήξης:</strong> ${new Date(endDate).toLocaleDateString('el-GR')}</p>
          <p><strong>Αιτιολογία:</strong> ${reason}</p>
        </div>
        
        <p>Θα ενημερωθείτε μόλις ο διαχειριστής σας επεξεργαστεί την αίτησή σας.</p>
      </div>
    `
  }),

  managerNotification: (managerName, employeeName, startDate, endDate, reason) => ({
    subject: 'Νέα Αίτηση Άδειας προς Έγκριση',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #FF9800;">Νέα Αίτηση Άδειας</h2>
        <p>Αγαπητέ/ή ${managerName},</p>
        <p>Ο/Η <strong>${employeeName}</strong> υπέβαλε αίτηση για άδεια.</p>
        
        <div style="background-color: #fff3e0; padding: 15px; margin: 20px 0; border-radius: 5px; border-left: 4px solid #FF9800;">
          <h3 style="margin-top: 0;">Λεπτομέρειες Αίτησης:</h3>
          <p><strong>Υπάλληλος:</strong> ${employeeName}</p>
          <p><strong>Ημερομηνία Έναρξης:</strong> ${new Date(startDate).toLocaleDateString('el-GR')}</p>
          <p><strong>Ημερομηνία Λήξης:</strong> ${new Date(endDate).toLocaleDateString('el-GR')}</p>
          <p><strong>Αιτιολογία:</strong> ${reason}</p>
        </div>
        
        <p>Παρακαλώ συνδεθείτε στο σύστημα για να εγκρίνετε ή να απορρίψετε την αίτηση.</p>
      </div>
    `
  }),

  requestApproved: (employeeName, startDate, endDate, managerName) => ({
    subject: 'Η Αίτηση Άδειάς σας Εγκρίθηκε',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #4CAF50;">✓ Η αίτηση άδειάς σας εγκρίθηκε</h2>
        <p>Αγαπητέ/ή ${employeeName},</p>
        <p>Η αίτησή σας για άδεια έχει εγκριθεί από τον/την ${managerName}.</p>
        
        <div style="background-color: #e8f5e9; padding: 15px; margin: 20px 0; border-radius: 5px; border-left: 4px solid #4CAF50;">
          <h3 style="margin-top: 0;">Εγκεκριμένη Άδεια:</h3>
          <p><strong>Ημερομηνία Έναρξης:</strong> ${new Date(startDate).toLocaleDateString('el-GR')}</p>
          <p><strong>Ημερομηνία Λήξης:</strong> ${new Date(endDate).toLocaleDateString('el-GR')}</p>
        </div>
        
        <p>Καλή ξεκούραση!</p>
      </div>
    `
  }),

  requestRejected: (employeeName, startDate, endDate, managerName) => ({
    subject: 'Η Αίτηση Άδειάς σας Απορρίφθηκε',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #f44336;">Η αίτηση άδειάς σας δεν εγκρίθηκε</h2>
        <p>Αγαπητέ/ή ${employeeName},</p>
        <p>Δυστυχώς, η αίτησή σας για άδεια δεν εγκρίθηκε από τον/την ${managerName}.</p>
        
        <div style="background-color: #ffebee; padding: 15px; margin: 20px 0; border-radius: 5px; border-left: 4px solid #f44336;">
          <h3 style="margin-top: 0;">Λεπτομέρειες Αίτησης:</h3>
          <p><strong>Ημερομηνία Έναρξης:</strong> ${new Date(startDate).toLocaleDateString('el-GR')}</p>
          <p><strong>Ημερομηνία Λήξης:</strong> ${new Date(endDate).toLocaleDateString('el-GR')}</p>
        </div>
        
        <p>Για περισσότερες πληροφορίες, επικοινωνήστε με τον/την ${managerName}.</p>
      </div>
    `
  })
};

const sendEmail = async (to, template) => {
  try {
    if (!process.env.SMTP_USER || !process.env.SMTP_PASSWORD) {
      console.log('Email not configured - skipping email notification');
      return { success: true, skipped: true };
    }

    const transporter = createTransporter();
    
    const mailOptions = {
      from: `"Vacation System" <${process.env.SMTP_USER}>`,
      to: to,
      subject: template.subject,
      html: template.html,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent successfully:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error sending email:', error);
    return { success: false, error: error.message };
  }
};

module.exports = {
  sendRequestSubmittedEmail: async (employeeEmail, employeeName, startDate, endDate, reason) => {
    const template = emailTemplates.requestSubmitted(employeeName, startDate, endDate, reason);
    return sendEmail(employeeEmail, template);
  },

  sendManagerNotificationEmail: async (managerEmail, managerName, employeeName, startDate, endDate, reason) => {
    const template = emailTemplates.managerNotification(managerName, employeeName, startDate, endDate, reason);
    return sendEmail(managerEmail, template);
  },

  sendRequestApprovedEmail: async (employeeEmail, employeeName, startDate, endDate, managerName) => {
    const template = emailTemplates.requestApproved(employeeName, startDate, endDate, managerName);
    return sendEmail(employeeEmail, template);
  },

  sendRequestRejectedEmail: async (employeeEmail, employeeName, startDate, endDate, managerName) => {
    const template = emailTemplates.requestRejected(employeeName, startDate, endDate, managerName);
    return sendEmail(employeeEmail, template);
  }
};