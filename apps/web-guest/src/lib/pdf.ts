// Turns an on-screen element into a downloadable A4 PDF, entirely in the browser.
// html2canvas-pro is used because it understands modern CSS colors (oklch/oklab/color-mix from Tailwind v4);
// the original html2canvas crashes on them. Rendering through the browser also keeps Hebrew RTL text correct.

/** Render `el` to a canvas and build the PDF (split across A4 pages if it's long). */
export async function elementToPdf(el: HTMLElement) {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import("html2canvas-pro"), import("jspdf")]);
  const canvas = await html2canvas(el, {
    scale: Math.min(2, window.devicePixelRatio || 1) * 1.5,
    useCORS: true,
    backgroundColor: "#ffffff",
    logging: false,
  });

  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait", compress: true });
  const margin = 10;
  const pageW = pdf.internal.pageSize.getWidth() - margin * 2;
  const pageH = pdf.internal.pageSize.getHeight() - margin * 2;
  const pxPerMm = canvas.width / pageW;
  const pagePx = Math.floor(pageH * pxPerMm);

  // slice the tall canvas into page-sized strips
  for (let y = 0, page = 0; y < canvas.height; y += pagePx, page++) {
    const h = Math.min(pagePx, canvas.height - y);
    const strip = document.createElement("canvas");
    strip.width = canvas.width;
    strip.height = h;
    strip.getContext("2d")!.drawImage(canvas, 0, y, canvas.width, h, 0, 0, canvas.width, h);
    if (page > 0) pdf.addPage();
    pdf.addImage(strip.toDataURL("image/jpeg", 0.92), "JPEG", margin, margin, pageW, h / pxPerMm);
  }
  return pdf;
}

/** Build the PDF and trigger the download. */
export async function downloadElementAsPdf(el: HTMLElement, filename: string) {
  const pdf = await elementToPdf(el);
  pdf.save(filename);
}
