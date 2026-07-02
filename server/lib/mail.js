import { Resend } from "resend";
const resend = new Resend(process.env.MAIL_KEY);

/**
 * Resend 이메일 발송 유틸 (기본 from: onboarding@resend.dev)
 * @param {{email:string, subject:string, html:string}} param
 */
export async function sendMail({ email, subject, html }) {
  const res = await resend.emails.send({
    from: "onboarding@resend.dev",
    to: email,
    subject: subject,
    html: html,
  });
  return res;
}
