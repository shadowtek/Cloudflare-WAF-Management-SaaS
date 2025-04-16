import { createClient } from 'npm:@supabase/supabase-js@2.39.7';
import { corsHeaders } from '../_shared/cors.ts';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

const SMTP2GO_API_KEY = 'api-50265A3D6FDB42789B4DE246E944D506';

function formatEmailContent(type: string, content: string): string {
  let template = '';

  if (type === '2fa') {
    template = `
<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="text-align: center; margin-bottom: 20px;">
      <h1 style="color: #F97316;">WAFManager Pro</h1>
      <h2 style="color: #333;">Two-Factor Authentication Code</h2>
    </div>
    
    <div style="background-color: #f8f8f8; border: 1px solid #ddd; padding: 20px; border-radius: 5px; margin-bottom: 20px;">
      <p>Your verification code is:</p>
      <div style="background-color: #fff; padding: 15px; border: 2px solid #F97316; border-radius: 5px; text-align: center; margin: 15px 0;">
        <span style="font-size: 24px; font-weight: bold; letter-spacing: 3px;">${content}</span>
      </div>
      <p style="color: #666; font-size: 14px;">This code will expire in 10 minutes.</p>
    </div>

    <div style="color: #666; font-size: 12px; text-align: center; margin-top: 20px; padding-top: 20px; border-top: 1px solid #ddd;">
      <p>This is an automated message from WAFManager Pro. Please do not reply to this email.</p>
      <p>
        WAFManager Pro<br>
        Shadowtek Web Solutions<br>
        <a href="https://shadowtek.com.au" style="color: #F97316; text-decoration: none;">shadowtek.com.au</a>
      </p>
    </div>
  </div>
</body>
</html>`;
  } else if (type === 'test') {
    template = `
<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="text-align: center; margin-bottom: 20px;">
      <h1 style="color: #F97316;">WAFManager Pro</h1>
      <h2 style="color: #333;">Test Email</h2>
    </div>
    
    <div style="background-color: #f8f8f8; border: 1px solid #ddd; padding: 20px; border-radius: 5px;">
      <p>This is a test email from WAFManager Pro to verify that the email system is working correctly.</p>
      <p>If you received this email, it means your email configuration is working properly!</p>
    </div>

    <div style="color: #666; font-size: 12px; text-align: center; margin-top: 20px; padding-top: 20px; border-top: 1px solid #ddd;">
      <p>
        WAFManager Pro<br>
        Shadowtek Web Solutions<br>
        <a href="https://shadowtek.com.au" style="color: #F97316; text-decoration: none;">shadowtek.com.au</a>
      </p>
    </div>
  </div>
</body>
</html>`;
  } else {
    template = `
<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="text-align: center; margin-bottom: 20px;">
      <h1 style="color: #F97316;">WAFManager Pro</h1>
    </div>
    
    <div style="background-color: #f8f8f8; border: 1px solid #ddd; padding: 20px; border-radius: 5px;">
      ${content}
    </div>

    <div style="color: #666; font-size: 12px; text-align: center; margin-top: 20px; padding-top: 20px; border-top: 1px solid #ddd;">
      <p>
        WAFManager Pro<br>
        Shadowtek Web Solutions<br>
        <a href="https://shadowtek.com.au" style="color: #F97316; text-decoration: none;">shadowtek.com.au</a>
      </p>
    </div>
  </div>
</body>
</html>`;
  }

  return template;
}

async function sendEmail(to: string, subject: string, content: string, type = 'general') {
  try {
    console.log('Sending email to:', to);
    console.log('Subject:', subject);
    console.log('Type:', type);

    const htmlContent = formatEmailContent(type, content);
    const textContent = content + '\n\n--\nWAFManager Pro\nShadowtek Web Solutions\nhttps://shadowtek.com.au';

    const payload = {
      api_key: SMTP2GO_API_KEY,
      to: [to],
      sender: 'WAFManager Pro <no-reply@shadowtek.com.au>',
      subject: subject,
      text_body: textContent,
      html_body: htmlContent,
      custom_headers: [
        {
          header: 'Reply-To',
          value: 'support@shadowtek.com.au'
        }
      ]
    };

    console.log('Sending request to SMTP2GO...');

    const response = await fetch('https://api.smtp2go.com/v3/email/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('SMTP2GO API error response:', errorData);
      throw new Error(`SMTP2GO API error: ${JSON.stringify(errorData)}`);
    }

    const data = await response.json();
    console.log('SMTP2GO API Response:', JSON.stringify(data, null, 2));

    if (data.data?.error || !data.data?.succeeded) {
      throw new Error(`SMTP2GO send failed: ${JSON.stringify(data)}`);
    }

    console.log('Email sent successfully');
    return true;
  } catch (error) {
    console.error('Error sending email:', error);
    throw error;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { type, userId, subject, content, test } = await req.json();
    console.log('Received request:', { type, userId, subject, test });

    // Special test endpoint
    if (test === true) {
      try {
        console.log('Sending test email...');
        const testResult = await sendEmail(
          'steve@shadowtek.com.au',
          'WAFManager Pro Test Email',
          'This is a test email to verify the email system is working correctly.',
          'test'
        );
        return new Response(
          JSON.stringify({ success: testResult, message: 'Test email sent successfully' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } catch (error) {
        console.error('Test email error:', error);
        throw new Error(`Test email failed: ${error.message}`);
      }
    }

    if (!type || !userId || !subject || !content) {
      throw new Error('Missing required parameters');
    }

    // Get user's notification preferences
    const { data: preferences, error: prefError } = await supabase
      .from('notification_preferences')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (prefError) {
      console.error('Error fetching preferences:', prefError);
      throw prefError;
    }

    console.log('User preferences:', preferences);

    // Get user's email
    const { data: { user }, error: userError } = await supabase.auth.admin.getUserById(userId);
    if (userError) {
      console.error('Error fetching user:', userError);
      throw userError;
    }

    if (!user?.email) {
      throw new Error('User email not found');
    }

    console.log('Found user email:', user.email);

    let success = false;

    // Check notification type and user preferences
    if (type === 'security' && preferences?.security_alerts) {
      success = await sendEmail(user.email, subject, content, type === '2fa' ? '2fa' : 'general');
    } else if (type === 'update' && preferences?.email_notifications) {
      success = await sendEmail(user.email, subject, content, 'general');
    } else {
      console.log('Notification skipped due to preferences:', { type, preferences });
    }

    return new Response(
      JSON.stringify({ success }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in request handler:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: error instanceof Error ? error.stack : String(error)
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});