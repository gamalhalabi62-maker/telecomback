const nodemailer = require('nodemailer');

const createTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: Number(process.env.EMAIL_PORT) || 587,
    secure: false, 
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
};

const emailTemplate = ({ title, greeting, body, otp, footer, color = '#4A148C' }) => `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Arial, sans-serif; background-color: #f5f5f5; direction: rtl;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1); max-width: 600px;">
          
          <tr>
            <td style="background: linear-gradient(135deg, ${color}, #311B92); padding: 40px 30px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 26px; font-weight: 900;">
                🏆 نادي المصرية للاتصالات
              </h1>
              <p style="color: #FBC02D; margin: 8px 0 0; font-size: 14px; letter-spacing: 2px;">
                TELECOM EGYPT CLUB
              </p>
            </td>
          </tr>

          <tr>
            <td style="padding: 40px 30px;">
              <h2 style="color: #212121; margin: 0 0 20px; font-size: 22px;">
                ${greeting}
              </h2>
              
              <div style="color: #555; font-size: 16px; line-height: 1.8;">
                ${body}
              </div>

              ${otp ? `
              <div style="background: #F3E5F5; border: 2px dashed ${color}; border-radius: 12px; padding: 25px; margin: 30px 0; text-align: center;">
                <p style="color: #666; margin: 0 0 10px; font-size: 14px; font-weight: bold;">
                  رمز التحقق الخاص بك
                </p>
                <div style="font-size: 42px; font-weight: 900; color: ${color}; letter-spacing: 10px; font-family: 'Courier New', monospace;">
                  ${otp}
                </div>
                <p style="color: #999; margin: 15px 0 0; font-size: 12px;">
                  ⏱️ صالح لمدة 10 دقائق فقط
                </p>
              </div>
              ` : ''}

              <p style="color: #999; font-size: 13px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
                ${footer || 'إذا لم تكن أنت من طلب هذا، يمكنك تجاهل الرسالة بأمان.'}
              </p>
            </td>
          </tr>

          <tr>
            <td style="background-color: #f9f9f9; padding: 25px 30px; text-align: center; border-top: 1px solid #eee;">
              <p style="color: #666; margin: 0 0 10px; font-size: 14px; font-weight: bold;">
                نادي المصرية للاتصالات
              </p>
              <p style="color: #999; margin: 0; font-size: 12px;">
                © ${new Date().getFullYear()} جميع الحقوق محفوظة
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

const sendOTPEmail = async (to, otp, name = '') => {
  const transporter = createTransporter();

  const html = emailTemplate({
    title: 'رمز التحقق - نادي المصرية للاتصالات',
    greeting: `مرحباً ${name || 'بك'} 👋`,
    body: `
      <p>شكراً لتسجيلك في <strong>نادي المصرية للاتصالات</strong>.</p>
      <p>لاستكمال عملية التسجيل، يرجى إدخال رمز التحقق التالي:</p>
    `,
    otp,
    footer: 'هذا الرمز صالح لمدة 10 دقائق. إذا لم تكن أنت من طلب التسجيل، يرجى تجاهل هذه الرسالة.',
  });

  const mailOptions = {
    from: `"${process.env.EMAIL_FROM_NAME || 'نادي المصرية للاتصالات'}" <${process.env.EMAIL_USER}>`,
    to,
    subject: '🔐 رمز التحقق - نادي المصرية للاتصالات',
    html,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ OTP Email sent to ${to}:`, info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('❌ Email send error:', error.message);
    return { success: false, error: error.message };
  }
};

const sendNotificationEmail = async (to, name, title, body, link = '') => {
  const transporter = createTransporter();

  const html = emailTemplate({
    title,
    greeting: `مرحباً ${name || 'عزيزنا'} 👋`,
    body: `
      <p>${body}</p>
      ${link ? `<p style="margin-top: 20px;"><a href="${link}" style="background: #4A148C; color: #fff; padding: 12px 30px; border-radius: 8px; text-decoration: none; font-weight: bold; display: inline-block;">اقرأ المزيد</a></p>` : ''}
    `,
    footer: 'أنت تتلقى هذا الإيميل لأنك مشترك في نادي المصرية للاتصالات.',
  });

  const mailOptions = {
    from: `"${process.env.EMAIL_FROM_NAME || 'نادي المصرية للاتصالات'}" <${process.env.EMAIL_USER}>`,
    to,
    subject: `🏆 ${title}`,
    html,
  };

  try {
    await transporter.sendMail(mailOptions);
    return { success: true };
  } catch (error) {
    console.error('❌ Notification Email error:', error.message);
    return { success: false, error: error.message };
  }
};

module.exports = { sendOTPEmail, sendNotificationEmail };