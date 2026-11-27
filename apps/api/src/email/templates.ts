import { formatILS, type ReceiptView } from "@bwl/shared";

export const esc = (s: string) =>
  s.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]!);

export function layout(title: string, body: string) {
  return `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><title>${esc(title)}</title></head>
<body style="margin:0;background:#F2F8FF;font-family:Rubik,Heebo,Arial,sans-serif;color:#1D2B4F">
<div style="max-width:560px;margin:0 auto;padding:24px">
  <div style="background:#3FA9F5;color:#fff;border-radius:20px 20px 0 0;padding:20px 24px;font-size:22px;font-weight:700">🎁 רשימת משאלות ליום הולדת</div>
  <div style="background:#fff;border-radius:0 0 20px 20px;padding:24px;line-height:1.6;font-size:16px">${body}</div>
  <p style="font-size:12px;color:#6B7A99;text-align:center;margin-top:16px">נשלח אוטומטית · Birthday Wish List</p>
</div></body></html>`;
}

const button = (href: string, label: string) =>
  `<p style="margin:24px 0"><a href="${esc(href)}" style="background:#FFC93C;color:#1D2B4F;text-decoration:none;padding:14px 24px;border-radius:14px;font-weight:700;display:inline-block">${esc(label)}</a></p>`;

export function consentEmail(kidFirstName: string, verifyUrl: string) {
  return {
    subject: `${kidFirstName} רוצה לפתוח רשימת משאלות ליום הולדת`,
    html: layout(
      "אישור הורה",
      `<h2 style="margin-top:0">שלום! 👋</h2>
<p><b>${esc(kidFirstName)}</b> נרשם/ה לאפליקציית רשימת המשאלות ליום הולדת וציין/ה את כתובת המייל שלך כהורה.</p>
<p>באפליקציה הילד/ה בוחר/ת מתנות מחנויות מקומיות ומשתף/ת קישור עם המשפחה והחברים. בדף הציבורי מוצג רק השם הפרטי, הרשימה והעיצוב — בלי מייל, שם משפחה, גיל או כתובת.</p>
<p>כדי לאשר ולאפשר שיתוף של הרשימה, יש ללחוץ כאן:</p>
${button(verifyUrl, "אני מאשר/ת ✔")}
<p style="font-size:13px;color:#6B7A99">אם לא ביקשת את זה, אפשר להתעלם מהמייל והחשבון יישאר מוגבל.</p>`,
    ),
  };
}

export function resetEmail(resetUrl: string) {
  return {
    subject: "איפוס סיסמה · רשימת משאלות",
    html: layout(
      "איפוס סיסמה",
      `<h2 style="margin-top:0">שכחת סיסמה? קורה 🙂</h2>
<p>לחצו על הכפתור כדי לבחור סיסמה חדשה. הקישור תקף לשעה אחת.</p>
${button(resetUrl, "לבחירת סיסמה חדשה")}
<p style="font-size:13px;color:#6B7A99">אם לא ביקשת איפוס, אפשר להתעלם מהמייל.</p>`,
    ),
  };
}

export function receiptEmail(r: ReceiptView, billUrl: string) {
  const rows = r.orders
    .flatMap((o) =>
      o.items.map(
        (i) =>
          `<tr><td style="padding:6px 0">${esc(i.title)}<br><span style="font-size:12px;color:#6B7A99">${esc(o.shop.name)}</span></td><td style="text-align:left;white-space:nowrap">${formatILS(i.priceAgorot * i.quantity)}</td></tr>`,
      ),
    )
    .join("");
  return {
    subject: `קבלה ${r.number} · מתנה ל${r.kidFirstName} 🎁`,
    html: layout(
      "קבלה",
      `<h2 style="margin-top:0">תודה ${esc(r.buyerName)}! 🎉</h2>
<p>ההזמנה של המתנה ל<b>${esc(r.kidFirstName)}</b> התקבלה! 🛍️ שלחנו אותה לחנות כדי לבדוק שהיא במלאי ולשמור אותה בצד בשבילך — החנות תעדכן אותך במייל.</p><p>הנה עותק של הקבלה:</p>
<p><b>מספר הזמנה:</b> ${esc(r.number)}<br><b>תאריך:</b> ${new Date(r.createdAt).toLocaleString("he-IL", { timeZone: "Asia/Jerusalem" })}</p>
<table style="width:100%;border-collapse:collapse;font-size:15px">${rows}
<tr><td colspan="2"><hr style="border:none;border-top:1px solid #E3ECF7"></td></tr>
<tr><td>לפני מע״מ</td><td style="text-align:left">${formatILS(r.subtotalAgorot)}</td></tr>
<tr><td>מע״מ ${r.vatRateBp / 100}%</td><td style="text-align:left">${formatILS(r.vatAgorot)}</td></tr>
<tr><td><b>סה״כ לתשלום</b></td><td style="text-align:left"><b>${formatILS(r.totalAgorot)}</b></td></tr></table>
${r.greeting ? `<p style="background:#FFF7DD;border-radius:12px;padding:12px"><b>הברכה שלך:</b><br>${esc(r.greeting)}</p>` : ""}
<p><b>איסוף/משלוח:</b> ${r.deliveryMethod === "pickup" ? "איסוף מהחנות" : "משלוח"}</p>
${button(billUrl, "לצפייה בקבלה והורדת PDF")}`,
    ),
  };
}

export function orderNewEmail(shopName: string, orderNumber: string, items: string[], totalAgorot: number, dashboardUrl: string) {
  return {
    subject: `הזמנה חדשה ${orderNumber} 🛍️`,
    html: layout(
      "הזמנה חדשה",
      `<h2 style="margin-top:0">שלום ${esc(shopName)}, יש הזמנה חדשה!</h2>
<p><b>מספר הזמנה:</b> ${esc(orderNumber)}</p>
<ul>${items.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>
<p><b>סה״כ:</b> ${formatILS(totalAgorot)}</p>
${button(dashboardUrl, "לניהול ההזמנה")}`,
    ),
  };
}

export function shopPendingEmail(shopName: string, adminUrl: string) {
  return {
    subject: `חנות חדשה ממתינה לאישור: ${shopName}`,
    html: layout("חנות חדשה", `<p>החנות <b>${esc(shopName)}</b> נרשמה וממתינה לאישור.</p>${button(adminUrl, "למסך האישורים")}`),
  };
}

export function shopDecisionEmail(shopName: string, approved: boolean, portalUrl: string) {
  return {
    subject: approved ? `החנות ${shopName} אושרה! 🎉` : `עדכון לגבי החנות ${shopName}`,
    html: layout(
      "סטטוס חנות",
      approved
        ? `<p>מזל טוב! <b>${esc(shopName)}</b> אושרה. המוצרים שלך מופיעים עכשיו לילדים באפליקציה.</p>${button(portalUrl, "לפורטל החנויות")}`
        : `<p>לצערנו לא אישרנו כרגע את <b>${esc(shopName)}</b>. אפשר לפנות אלינו לפרטים.</p>`,
    ),
  };
}

export function consentDonePage(ok: boolean) {
  return layout(
    "אישור הורה",
    ok
      ? `<h2 style="margin-top:0">תודה! ✔</h2><p>החשבון אושר ועכשיו אפשר לשתף את רשימת המשאלות עם המשפחה והחברים.</p>`
      : `<h2 style="margin-top:0">הקישור לא תקף</h2><p>ייתכן שכבר אושר או שפג תוקפו. אפשר לבקש קישור חדש מהאפליקציה.</p>`,
  );
}
