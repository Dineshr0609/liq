import { db } from './db.js';
import { emailTemplates } from '@shared/schema.js';
import { eq } from 'drizzle-orm';

function getLogoUrl(): string {
  const devDomain = process.env.REPLIT_DEV_DOMAIN;
  const deployedDomains = process.env.REPLIT_DOMAINS;
  let domain = 'https://www.licenseiq.ai';
  if (devDomain) {
    domain = `https://${devDomain}`;
  } else if (deployedDomains) {
    const firstDomain = deployedDomains.split(',')[0].trim();
    if (firstDomain) domain = `https://${firstDomain}`;
  }
  return `${domain}/licenseiq-logo-email.png`;
}

function brandedWrapper(innerContent: string): string {
  const logoUrl = getLogoUrl();
  const logoHtml = `<img src="${logoUrl}" alt="LicenseIQ" width="220" style="display:block;margin:0 auto;max-width:220px;height:auto;" />`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:40px 20px;">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

<!-- HEADER -->
<tr><td style="background-color:#000000;padding:30px 40px;text-align:center;border-radius:12px 12px 0 0;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr>
<td style="text-align:center;">
${logoHtml}
<p style="margin:10px 0 0;font-size:13px;color:#a1a1aa;letter-spacing:1px;text-transform:uppercase;">AI-Native Contract Intelligence</p>
</td>
</tr>
</table>
</td></tr>

<!-- ORANGE ACCENT BAR -->
<tr><td style="background-color:#ea580c;height:4px;font-size:0;line-height:0;">&nbsp;</td></tr>

<!-- BODY -->
<tr><td style="background-color:#ffffff;padding:40px;">
${innerContent}
</td></tr>

<!-- FOOTER -->
<tr><td style="background-color:#fafafa;padding:30px 40px;border-top:1px solid #e4e4e7;border-radius:0 0 12px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr><td style="text-align:center;">
<p style="margin:0 0 8px;font-size:13px;color:#71717a;">
Need help? Contact us at <a href="mailto:info@licenseiq.ai" style="color:#ea580c;text-decoration:none;">info@licenseiq.ai</a>
</p>
<p style="margin:0 0 16px;font-size:13px;color:#71717a;">
<a href="https://www.licenseiq.ai" style="color:#ea580c;text-decoration:none;">www.licenseiq.ai</a>
</p>
<p style="margin:0;font-size:11px;color:#a1a1aa;">
&copy; ${new Date().getFullYear()} CimpleIT LLC. All rights reserved.<br>
LicenseIQ is a product of CimpleIT LLC.
</p>
</td></tr>
</table>
</td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}

function replaceVariables(template: string, vars: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value || '');
  }
  return result;
}

export async function getEmailTemplate(templateKey: string): Promise<{ subject: string; htmlBody: string } | null> {
  try {
    const [template] = await db.select().from(emailTemplates).where(eq(emailTemplates.templateKey, templateKey)).limit(1);
    if (template && template.isActive) {
      return { subject: template.subject, htmlBody: template.htmlBody };
    }
  } catch (err) {
    console.warn(`⚠️ Could not load email template "${templateKey}" from DB, using default`);
  }
  return null;
}

export async function renderEmail(templateKey: string, variables: Record<string, string>): Promise<{ subject: string; html: string }> {
  const dbTemplate = await getEmailTemplate(templateKey);
  const defaults = DEFAULT_TEMPLATES[templateKey];

  if (!dbTemplate && !defaults) {
    throw new Error(`Email template "${templateKey}" not found`);
  }

  const subject = replaceVariables(dbTemplate?.subject || defaults.subject, variables);
  const bodyContent = replaceVariables(dbTemplate?.htmlBody || defaults.htmlBody, variables);
  const html = brandedWrapper(bodyContent);

  return { subject, html };
}

export const DEFAULT_TEMPLATES: Record<string, { name: string; subject: string; htmlBody: string; description: string; variables: string[] }> = {
  'early_access_confirmation': {
    name: 'Early Access - Customer Confirmation',
    subject: 'Welcome to LicenseIQ Early Access',
    description: 'Sent to the customer after they submit the Early Access form on the landing page.',
    variables: ['name', 'email', 'company', 'year'],
    htmlBody: `<h2 style="color:#18181b;margin:0 0 8px;font-size:24px;font-weight:600;">Thank You for Your Interest!</h2>
<p style="color:#71717a;font-size:16px;margin:0 0 30px;">You're on the list for early access to LicenseIQ.</p>

<p style="color:#3f3f46;font-size:15px;line-height:1.7;">Hi {{name}},</p>
<p style="color:#3f3f46;font-size:15px;line-height:1.7;">We're thrilled that you've signed up for early access to LicenseIQ. Our accounts team will review your request and reach out within <strong>1-2 business days</strong> to discuss how LicenseIQ can transform your contract management.</p>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:25px 0;">
<tr><td style="background-color:#fafafa;padding:20px 24px;border-radius:8px;border:1px solid #e4e4e7;">
<p style="margin:0 0 4px;font-size:13px;color:#71717a;text-transform:uppercase;letter-spacing:0.5px;">Your Registration</p>
<p style="margin:6px 0;color:#3f3f46;font-size:14px;"><strong>Name:</strong> {{name}}</p>
<p style="margin:6px 0;color:#3f3f46;font-size:14px;"><strong>Email:</strong> {{email}}</p>
<p style="margin:6px 0;color:#3f3f46;font-size:14px;"><strong>Company:</strong> {{company}}</p>
</td></tr>
</table>

<p style="margin:0 0 6px;font-size:15px;font-weight:600;color:#18181b;">What You'll Get with LicenseIQ:</p>
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:12px 0 25px;">
<tr><td style="padding:4px 0;color:#3f3f46;font-size:14px;">&#x2714;&#xFE0F; AI-native contract analysis and risk assessment</td></tr>
<tr><td style="padding:4px 0;color:#3f3f46;font-size:14px;">&#x2714;&#xFE0F; Automated payment calculations and compliance checks</td></tr>
<tr><td style="padding:4px 0;color:#3f3f46;font-size:14px;">&#x2714;&#xFE0F; Dynamic rule engine for complex licensing agreements</td></tr>
<tr><td style="padding:4px 0;color:#3f3f46;font-size:14px;">&#x2714;&#xFE0F; liQ AI — your intelligent contract assistant</td></tr>
<tr><td style="padding:4px 0;color:#3f3f46;font-size:14px;">&#x2714;&#xFE0F; Seamless ERP integration with intelligent field mapping</td></tr>
</table>

<p style="color:#3f3f46;font-size:15px;line-height:1.7;">We'll be in touch soon. In the meantime, feel free to reply to this email with any questions.</p>

<p style="color:#3f3f46;font-size:15px;line-height:1.7;margin-top:25px;">
Best regards,<br>
<strong>The LicenseIQ Team</strong>
</p>`,
  },

  'early_access_admin_notification': {
    name: 'Early Access - Admin Notification',
    subject: 'New Early Access Signup - {{name}} ({{company}})',
    description: 'Sent to the internal team when a new Early Access form is submitted.',
    variables: ['name', 'email', 'company', 'position', 'message', 'signupId', 'date'],
    htmlBody: `<h2 style="color:#18181b;margin:0 0 20px;font-size:22px;font-weight:600;">New Early Access Signup</h2>
<p style="color:#3f3f46;font-size:15px;line-height:1.7;">A new user has requested early access to LicenseIQ Research Platform.</p>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;">
<tr><td style="background-color:#fff7ed;padding:20px 24px;border-radius:8px;border:1px solid #fed7aa;">
<p style="margin:6px 0;color:#3f3f46;font-size:14px;"><strong>Name:</strong> {{name}}</p>
<p style="margin:6px 0;color:#3f3f46;font-size:14px;"><strong>Email:</strong> {{email}}</p>
<p style="margin:6px 0;color:#3f3f46;font-size:14px;"><strong>Company:</strong> {{company}}</p>
<p style="margin:6px 0;color:#3f3f46;font-size:14px;"><strong>Position:</strong> {{position}}</p>
<p style="margin:6px 0;color:#3f3f46;font-size:14px;"><strong>Use Case:</strong> {{message}}</p>
<p style="margin:6px 0;color:#3f3f46;font-size:14px;"><strong>Source:</strong> Landing Page</p>
<p style="margin:6px 0;color:#3f3f46;font-size:14px;"><strong>Signup ID:</strong> {{signupId}}</p>
<p style="margin:6px 0;color:#3f3f46;font-size:14px;"><strong>Date:</strong> {{date}}</p>
</td></tr>
</table>

<p style="font-size:14px;font-weight:600;color:#18181b;margin:0 0 8px;">Next Steps:</p>
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 20px;">
<tr><td style="padding:3px 0;color:#3f3f46;font-size:14px;">1. Review the signup details above</td></tr>
<tr><td style="padding:3px 0;color:#3f3f46;font-size:14px;">2. Contact the user within 1-2 business days</td></tr>
<tr><td style="padding:3px 0;color:#3f3f46;font-size:14px;">3. Schedule a personalized demo</td></tr>
<tr><td style="padding:3px 0;color:#3f3f46;font-size:14px;">4. Create workspace after verification</td></tr>
</table>`,
  },

  'demo_request_confirmation': {
    name: 'Demo Request - Customer Confirmation',
    subject: 'Your LicenseIQ {{planName}} Demo Request',
    description: 'Sent to the customer after they request a demo from the pricing page.',
    variables: ['email', 'planName', 'planFeatures', 'year'],
    htmlBody: `<h2 style="color:#18181b;margin:0 0 8px;font-size:24px;font-weight:600;">Demo Request Received!</h2>
<p style="color:#71717a;font-size:16px;margin:0 0 30px;">We'll schedule your personalized {{planName}} demo soon.</p>

<p style="color:#3f3f46;font-size:15px;line-height:1.7;">Thank you for your interest in <strong>{{planName}}</strong>. Our accounts team will contact you within <strong>24 hours</strong> to schedule a personalized demo at your convenience.</p>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:25px 0;">
<tr><td style="background-color:#fafafa;padding:20px 24px;border-radius:8px;border:1px solid #e4e4e7;">
<p style="margin:0 0 12px;font-size:14px;font-weight:600;color:#18181b;">{{planName}} Includes:</p>
<p style="margin:0;color:#3f3f46;font-size:14px;line-height:1.8;">{{planFeatures}}</p>
</td></tr>
</table>

<p style="color:#3f3f46;font-size:15px;line-height:1.7;">In the meantime, feel free to reply to this email with any questions about LicenseIQ.</p>

<p style="color:#3f3f46;font-size:15px;line-height:1.7;margin-top:25px;">
Looking forward to showing you the future of contract intelligence!<br>
<strong>The LicenseIQ Team</strong>
</p>`,
  },

  'demo_request_admin_notification': {
    name: 'Demo Request - Admin Notification',
    subject: 'New Demo Request - {{planName}} ({{email}})',
    description: 'Sent to the internal team when a new demo is requested.',
    variables: ['email', 'planName', 'requestId', 'date'],
    htmlBody: `<h2 style="color:#18181b;margin:0 0 20px;font-size:22px;font-weight:600;">New Demo Request</h2>
<p style="color:#3f3f46;font-size:15px;line-height:1.7;">A new user has requested a personalized demo for <strong>{{planName}}</strong>.</p>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;">
<tr><td style="background-color:#fff7ed;padding:20px 24px;border-radius:8px;border:1px solid #fed7aa;">
<p style="margin:6px 0;color:#3f3f46;font-size:14px;"><strong>Email:</strong> {{email}}</p>
<p style="margin:6px 0;color:#3f3f46;font-size:14px;"><strong>Plan Tier:</strong> {{planName}}</p>
<p style="margin:6px 0;color:#3f3f46;font-size:14px;"><strong>Source:</strong> Pricing Section</p>
<p style="margin:6px 0;color:#3f3f46;font-size:14px;"><strong>Request ID:</strong> {{requestId}}</p>
<p style="margin:6px 0;color:#3f3f46;font-size:14px;"><strong>Date:</strong> {{date}}</p>
</td></tr>
</table>

<p style="font-size:14px;font-weight:600;color:#18181b;margin:0 0 8px;">Next Steps:</p>
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 20px;">
<tr><td style="padding:3px 0;color:#3f3f46;font-size:14px;">1. Review the demo request in Admin > Leads</td></tr>
<tr><td style="padding:3px 0;color:#3f3f46;font-size:14px;">2. Contact the user within 24 hours to schedule</td></tr>
<tr><td style="padding:3px 0;color:#3f3f46;font-size:14px;">3. Prepare personalized demo based on {{planName}} features</td></tr>
</table>`,
  },

  'verification_request': {
    name: 'Verification Request',
    subject: 'LicenseIQ — Quick Verification Before We Set Up Your Workspace',
    description: 'Sent by the accounts team with a verification form link for the lead to complete.',
    variables: ['name', 'email', 'company', 'verifyUrl', 'year'],
    htmlBody: `<h2 style="color:#18181b;margin:0 0 8px;font-size:24px;font-weight:600;">Almost There!</h2>
<p style="color:#71717a;font-size:16px;margin:0 0 30px;">We just need to verify a few details before setting up your workspace.</p>

<p style="color:#3f3f46;font-size:15px;line-height:1.7;">Hi {{name}},</p>
<p style="color:#3f3f46;font-size:15px;line-height:1.7;">Thank you for your interest in <strong>LicenseIQ</strong>! Before we create your personalized workspace, we'd like to confirm a few details to ensure we set everything up correctly for you.</p>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:25px 0;">
<tr><td style="background-color:#fafafa;padding:20px 24px;border-radius:8px;border:1px solid #e4e4e7;">
<p style="margin:0 0 4px;font-size:13px;color:#71717a;text-transform:uppercase;letter-spacing:0.5px;">What We Have on File</p>
<p style="margin:8px 0;color:#3f3f46;font-size:14px;"><strong>Name:</strong> {{name}}</p>
<p style="margin:8px 0;color:#3f3f46;font-size:14px;"><strong>Email:</strong> {{email}}</p>
<p style="margin:8px 0;color:#3f3f46;font-size:14px;"><strong>Company:</strong> {{company}}</p>
</td></tr>
</table>

<p style="color:#3f3f46;font-size:15px;line-height:1.7;">Please click the button below to complete a quick verification form. It only takes about 1 minute:</p>

<table role="presentation" cellpadding="0" cellspacing="0" style="margin:25px auto;">
<tr><td style="background-color:#ea580c;border-radius:8px;text-align:center;">
<a href="{{verifyUrl}}" style="display:inline-block;padding:16px 48px;color:#ffffff;font-size:16px;font-weight:600;text-decoration:none;letter-spacing:0.3px;">Complete Verification Form</a>
</td></tr>
</table>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 25px;">
<tr><td style="background-color:#fafafa;padding:16px 20px;border-radius:8px;border:1px solid #e4e4e7;">
<p style="margin:0 0 8px;font-size:13px;color:#71717a;text-transform:uppercase;letter-spacing:0.5px;">What we'll ask</p>
<p style="margin:4px 0;font-size:14px;color:#3f3f46;">1. Company website URL</p>
<p style="margin:4px 0;font-size:14px;color:#3f3f46;">2. Your role / job title</p>
<p style="margin:4px 0;font-size:14px;color:#3f3f46;">3. Number of contracts you manage</p>
<p style="margin:4px 0;font-size:14px;color:#3f3f46;">4. What you're hoping to achieve</p>
<p style="margin:4px 0;font-size:14px;color:#3f3f46;">5. How you heard about us</p>
</td></tr>
</table>

<p style="color:#3f3f46;font-size:15px;line-height:1.7;">Once we review your details, our team will create your workspace within <strong>1 business day</strong> and send you your login credentials.</p>

<p style="color:#71717a;font-size:13px;line-height:1.6;margin-top:20px;">If the button doesn't work, copy and paste this link into your browser:<br>
<a href="{{verifyUrl}}" style="color:#ea580c;text-decoration:none;word-break:break-all;">{{verifyUrl}}</a></p>

<p style="color:#3f3f46;font-size:15px;line-height:1.7;margin-top:25px;">
Looking forward to getting you started,<br>
<strong>The LicenseIQ Accounts Team</strong>
</p>`,
  },

  'workspace_ready': {
    name: 'Workspace Ready - Customer Welcome',
    subject: 'Your LicenseIQ Workspace is Ready!',
    description: 'Sent to the customer after the accounts team has set up their workspace and created their login.',
    variables: ['name', 'email', 'company', 'loginUrl', 'tempPassword', 'year'],
    htmlBody: `<h2 style="color:#18181b;margin:0 0 8px;font-size:24px;font-weight:600;">Your Workspace is Ready!</h2>
<p style="color:#71717a;font-size:16px;margin:0 0 30px;">We've set up everything for you to get started.</p>

<p style="color:#3f3f46;font-size:15px;line-height:1.7;">Hi {{name}},</p>
<p style="color:#3f3f46;font-size:15px;line-height:1.7;">Great news! Your LicenseIQ workspace for <strong>{{company}}</strong> has been set up and is ready for you. We've pre-loaded sample data so you can explore the platform right away.</p>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:25px 0;">
<tr><td style="background-color:#fafafa;padding:20px 24px;border-radius:8px;border:1px solid #e4e4e7;">
<p style="margin:0 0 4px;font-size:13px;color:#71717a;text-transform:uppercase;letter-spacing:0.5px;">Your Login Credentials</p>
<p style="margin:8px 0;color:#3f3f46;font-size:14px;"><strong>Login URL:</strong> <a href="{{loginUrl}}" style="color:#ea580c;text-decoration:none;">{{loginUrl}}</a></p>
<p style="margin:8px 0;color:#3f3f46;font-size:14px;"><strong>Email:</strong> {{email}}</p>
<p style="margin:8px 0;color:#3f3f46;font-size:14px;"><strong>Temporary Password:</strong> {{tempPassword}}</p>
<p style="margin:12px 0 0;color:#dc2626;font-size:13px;font-style:italic;">Please change your password after your first login.</p>
</td></tr>
</table>

<table role="presentation" cellpadding="0" cellspacing="0" style="margin:25px auto;">
<tr><td style="background-color:#ea580c;border-radius:8px;text-align:center;">
<a href="{{loginUrl}}" style="display:inline-block;padding:14px 40px;color:#ffffff;font-size:16px;font-weight:600;text-decoration:none;">Log In to Your Workspace</a>
</td></tr>
</table>

<p style="margin:25px 0 6px;font-size:15px;font-weight:600;color:#18181b;">Getting Started:</p>
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 25px;">
<tr><td style="padding:4px 0;color:#3f3f46;font-size:14px;">1. Log in and explore the sample contracts we've loaded</td></tr>
<tr><td style="padding:4px 0;color:#3f3f46;font-size:14px;">2. Try uploading your own contract to see AI-native analysis</td></tr>
<tr><td style="padding:4px 0;color:#3f3f46;font-size:14px;">3. Ask liQ AI questions about your contracts</td></tr>
<tr><td style="padding:4px 0;color:#3f3f46;font-size:14px;">4. Review the calculation engine and rule builder</td></tr>
</table>

<p style="color:#3f3f46;font-size:15px;line-height:1.7;">If you need any help getting started, simply reply to this email or reach out at <a href="mailto:info@licenseiq.ai" style="color:#ea580c;text-decoration:none;">info@licenseiq.ai</a>.</p>

<p style="color:#3f3f46;font-size:15px;line-height:1.7;margin-top:25px;">
Welcome aboard!<br>
<strong>The LicenseIQ Team</strong>
</p>`,
  },

  'personal_followup': {
    name: 'Personal Follow-Up',
    subject: 'Quick question about your LicenseIQ experience',
    description: 'Personal follow-up email sent by an account executive to engage with the customer.',
    variables: ['name', 'senderName', 'senderTitle', 'senderEmail', 'senderPhone', 'year'],
    htmlBody: `<p style="color:#3f3f46;font-size:15px;line-height:1.7;">Hi {{name}},</p>

<p style="color:#3f3f46;font-size:15px;line-height:1.7;">Welcome to LicenseIQ! I wanted to personally reach out and see how things are going.</p>

<p style="color:#3f3f46;font-size:15px;line-height:1.7;">When you have a moment, could you share what you're hoping to achieve with LicenseIQ? Understanding your goals helps us make sure you get the most out of the platform.</p>

<p style="color:#3f3f46;font-size:15px;line-height:1.7;">I'm here to help — feel free to reply to this email or book time with me for a quick walkthrough.</p>

<p style="color:#3f3f46;font-size:15px;line-height:1.7;">Looking forward to hearing from you!</p>

<p style="color:#3f3f46;font-size:15px;line-height:1.7;margin-top:20px;">
Take care,<br>
<strong>{{senderName}}</strong><br>
<span style="color:#ea580c;">{{senderTitle}}</span>
</p>

<table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:20px;border-top:1px solid #e4e4e7;padding-top:15px;">
<tr>
<td style="padding-right:15px;vertical-align:top;">
<table role="presentation" cellpadding="0" cellspacing="0">
<tr><td style="font-size:14px;font-weight:600;color:#18181b;">{{senderName}}</td></tr>
<tr><td style="font-size:13px;color:#ea580c;">{{senderTitle}}</td></tr>
<tr><td style="font-size:13px;color:#71717a;padding-top:6px;">{{senderEmail}}</td></tr>
<tr><td style="font-size:13px;color:#71717a;">{{senderPhone}}</td></tr>
<tr><td style="padding-top:8px;"><a href="https://www.licenseiq.ai" style="font-size:13px;color:#ea580c;text-decoration:none;">www.licenseiq.ai</a></td></tr>
</table>
</td>
</tr>
</table>`,
  },
};

export async function seedDefaultTemplates(): Promise<void> {
  for (const [key, template] of Object.entries(DEFAULT_TEMPLATES)) {
    try {
      const existing = await db.select().from(emailTemplates).where(eq(emailTemplates.templateKey, key)).limit(1);
      if (existing.length === 0) {
        await db.insert(emailTemplates).values({
          templateKey: key,
          name: template.name,
          subject: template.subject,
          htmlBody: template.htmlBody,
          description: template.description,
          variables: template.variables,
          isActive: true,
        });
        console.log(`📧 Seeded email template: ${key}`);
      }
    } catch (err) {
      console.warn(`⚠️ Failed to seed template ${key}:`, err);
    }
  }
}
