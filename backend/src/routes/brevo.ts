import { Router } from 'express';

export const brevoRouter = Router();

interface SendLeadPayload {
  name: string;
  email: string;
  company: string;
  title: string;
}

interface CampaignPayload {
  leads: SendLeadPayload[];
  sandboxMode: boolean;
  senderEmail?: string;
  senderName?: string;
  subject?: string;
  htmlContent?: string;
  testInbox?: string;
}

function generateOutreachHtml(lead: SendLeadPayload): string {
  return `
<!DOCTYPE html>
<html>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1a1a1a; line-height: 1.6; max-width: 600px; margin: 0 auto; padding: 20px;">
  <p>Hi ${lead.name.split(' ')[0]},</p>
  <p>I noticed your work as <strong>${lead.title}</strong> at <strong>${lead.company}</strong> and wanted to reach out.</p>
  <p>We help companies like ${lead.company} streamline their outreach and connect with the right decision-makers — saving hours of manual prospecting every week.</p>
  <p>Would you be open to a quick 15-minute call this week to explore if this could be useful for your team?</p>
  <p>Best regards,<br/><strong>Autoreach Team</strong></p>
  <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 20px 0;"/>
  <p style="font-size: 11px; color: #999;">This email was sent via Autoreach. If you'd prefer not to receive further emails, simply reply with "unsubscribe".</p>
</body>
</html>`.trim();
}

/**
 * POST /api/brevo/send-campaign
 * Body: CampaignPayload
 * Returns: { results: Array<{ email, status, messageId? }>, summary: { sent, failed, total } }
 */
brevoRouter.post('/send-campaign', async (req, res) => {
  const {
    leads,
    sandboxMode,
    senderEmail = 'outreach@autoreach.dev',
    senderName = 'Autoreach',
    subject,
    htmlContent,
    testInbox = 'test-inbox@autoreach.dev',
  }: CampaignPayload = req.body;

  const apiKey = process.env.BREVO_API;

  if (!apiKey) {
    return res.status(500).json({ error: 'BREVO_API key not configured' });
  }

  if (!leads || !Array.isArray(leads) || leads.length === 0) {
    return res.status(400).json({ error: 'leads array is required and must not be empty' });
  }

  try {
    const results: Array<{ email: string; status: string; messageId?: string; error?: string }> = [];
    let sent = 0;
    let failed = 0;

    for (const lead of leads) {
      if (!lead.email) {
        results.push({ email: '', status: 'skipped', error: 'No email address' });
        failed++;
        continue;
      }

      const recipientEmail = sandboxMode ? testInbox : lead.email;
      const emailSubject = subject || `Quick question for ${lead.name.split(' ')[0]} at ${lead.company}`;
      const emailBody = htmlContent || generateOutreachHtml(lead);

      console.log(`[Brevo] Sending to ${recipientEmail}${sandboxMode ? ` (sandbox, original: ${lead.email})` : ''}`);

      try {
        const response = await fetch('https://api.brevo.com/v3/smtp/email', {
          method: 'POST',
          headers: {
            'api-key': apiKey,
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({
            sender: { name: senderName, email: senderEmail },
            to: [{ email: recipientEmail, name: lead.name }],
            subject: sandboxMode ? `[SANDBOX] ${emailSubject}` : emailSubject,
            htmlContent: emailBody,
            headers: {
              'X-Autoreach-Original-To': lead.email,
              'X-Autoreach-Sandbox': sandboxMode ? 'true' : 'false',
            },
          }),
        });

        if (response.ok) {
          const data = await response.json() as { messageId?: string };
          results.push({
            email: lead.email,
            status: 'sent',
            messageId: data.messageId,
          });
          sent++;
        } else {
          const errBody = await response.text();
          console.error(`[Brevo] Failed to send to ${recipientEmail}: ${response.status}`, errBody);

          if (response.status === 429) {
            console.warn('[Brevo] Rate limited. Waiting 2s...');
            await new Promise((r) => setTimeout(r, 2000));
          }

          results.push({
            email: lead.email,
            status: 'failed',
            error: `Brevo error ${response.status}: ${errBody}`,
          });
          failed++;
        }
      } catch (sendErr) {
        console.error(`[Brevo] Send error for ${lead.email}:`, sendErr);
        results.push({
          email: lead.email,
          status: 'failed',
          error: String(sendErr),
        });
        failed++;
      }

      // Small delay between sends
      await new Promise((r) => setTimeout(r, 200));
    }

    console.log(`[Brevo] Campaign complete: ${sent} sent, ${failed} failed out of ${leads.length}`);

    res.json({
      results,
      summary: {
        sent,
        failed,
        total: leads.length,
        sandboxMode,
      },
    });
  } catch (err) {
    console.error('[Brevo] Campaign failed:', err);
    res.status(500).json({ error: 'Failed to send campaign via Brevo', details: String(err) });
  }
});
