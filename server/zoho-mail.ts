import nodemailer from 'nodemailer';

interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
  fromName: string;
  fromEmail: string;
}

export async function getSmtpConfig(): Promise<SmtpConfig> {
  try {
    const { storage } = await import('./storage.js');
    const settings = await storage.getSystemSettings();
    
    if (settings?.smtpHost && settings?.smtpUser && settings?.smtpPassword) {
      return {
        host: settings.smtpHost,
        port: settings.smtpPort || 465,
        secure: settings.smtpSecure !== false,
        user: settings.smtpUser,
        password: settings.smtpPassword,
        fromName: settings.smtpFromName || 'LicenseIQ',
        fromEmail: settings.smtpFromEmail || settings.smtpUser,
      };
    }
  } catch (err) {
    console.warn('⚠️ Could not load SMTP settings from DB, falling back to env vars');
  }
  
  const email = process.env.ZOHO_EMAIL || 'info@licenseiq.ai';
  const password = process.env.ZOHO_PASSWORD;
  
  if (!password) {
    throw new Error('No SMTP password configured. Set it in System Settings > Email / SMTP or via ZOHO_PASSWORD env var.');
  }
  
  return {
    host: 'smtppro.zoho.com',
    port: 465,
    secure: true,
    user: email,
    password,
    fromName: 'LicenseIQ',
    fromEmail: email,
  };
}

export async function getNotificationEmail(): Promise<string> {
  try {
    const config = await getSmtpConfig();
    return config.fromEmail;
  } catch {
    return 'info@licenseiq.ai';
  }
}

export async function createSmtpTransporter(config?: SmtpConfig) {
  const smtp = config || await getSmtpConfig();

  const transporter = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure,
    auth: {
      user: smtp.user,
      pass: smtp.password,
    },
    tls: {
      rejectUnauthorized: true,
    },
  });

  return transporter;
}

export async function createZohoTransporter() {
  const transporter = await createSmtpTransporter();
  
  try {
    await transporter.verify();
    console.log('✅ SMTP connection verified');
  } catch (error) {
    console.error('❌ SMTP connection failed:', error);
    throw error;
  }

  return transporter;
}

export async function sendZohoEmail(options: {
  to: string | string[];
  subject: string;
  html: string;
  from?: string;
}) {
  const smtp = await getSmtpConfig();
  const transporter = await createSmtpTransporter(smtp);

  const mailOptions = {
    from: options.from || `"${smtp.fromName}" <${smtp.fromEmail}>`,
    to: Array.isArray(options.to) ? options.to.join(', ') : options.to,
    subject: options.subject,
    html: options.html,
  };

  const info = await transporter.sendMail(mailOptions);
  return info;
}

export async function testSmtpConnection(config: SmtpConfig): Promise<{ success: boolean; message: string }> {
  try {
    const transporter = await createSmtpTransporter(config);
    await transporter.verify();
    return { success: true, message: 'SMTP connection verified successfully' };
  } catch (error: any) {
    return { success: false, message: error.message || 'Connection failed' };
  }
}

export async function sendTestEmail(config: SmtpConfig, toEmail: string): Promise<{ success: boolean; message: string }> {
  try {
    const transporter = await createSmtpTransporter(config);
    
    await transporter.sendMail({
      from: `"${config.fromName}" <${config.fromEmail}>`,
      to: toEmail,
      subject: 'LicenseIQ - SMTP Test Email',
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 500px;">
          <h2 style="color: #ea580c;">SMTP Configuration Test</h2>
          <p>This is a test email from LicenseIQ to verify your SMTP settings are working correctly.</p>
          <hr style="border: 1px solid #e5e7eb; margin: 16px 0;" />
          <p style="font-size: 12px; color: #6b7280;">
            Host: ${config.host}:${config.port} | Secure: ${config.secure ? 'Yes' : 'No'} | From: ${config.fromEmail}
          </p>
          <p style="font-size: 12px; color: #6b7280;">Sent at: ${new Date().toISOString()}</p>
        </div>
      `,
    });
    
    return { success: true, message: `Test email sent successfully to ${toEmail}` };
  } catch (error: any) {
    return { success: false, message: error.message || 'Failed to send test email' };
  }
}
