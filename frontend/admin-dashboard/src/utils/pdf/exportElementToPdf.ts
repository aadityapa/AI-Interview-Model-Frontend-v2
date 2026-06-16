import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

/**
 * Renders a DOM subtree to a multi-page A4 PDF (JPEG slices) with consistent margins.
 */
export async function exportElementToPdf(element: HTMLElement, fileName: string): Promise<void> {
  if (!element?.isConnected) {
    throw new Error("PDF source element is not attached to the document.");
  }

  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    allowTaint: true,
    logging: false,
    backgroundColor: "#ffffff",
    windowWidth: element.scrollWidth,
    windowHeight: element.scrollHeight,
    imageTimeout: 20_000,
  });

  const pdf = new jsPDF({ orientation: "p", unit: "mm", format: "a4", compress: true });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const marginMm = 10;
  const pdfInnerW = pageWidth - 2 * marginMm;
  const pdfInnerH = pageHeight - 2 * marginMm;

  const totalImgHeightMm = (canvas.height * pdfInnerW) / canvas.width;
  let offsetMm = 0;
  let pageIndex = 0;

  while (offsetMm < totalImgHeightMm - 0.1) {
    if (pageIndex > 0) pdf.addPage();
    const sliceMm = Math.min(pdfInnerH, totalImgHeightMm - offsetMm);
    const slicePx = (sliceMm / totalImgHeightMm) * canvas.height;
    const srcY = (offsetMm / totalImgHeightMm) * canvas.height;

    const slice = document.createElement("canvas");
    slice.width = canvas.width;
    slice.height = Math.max(1, Math.ceil(slicePx));
    const ctx = slice.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D context unavailable.");
    ctx.drawImage(canvas, 0, srcY, canvas.width, slicePx, 0, 0, canvas.width, slicePx);

    const imgData = slice.toDataURL("image/jpeg", 0.92);
    pdf.addImage(imgData, "JPEG", marginMm, marginMm, pdfInnerW, sliceMm);

    offsetMm += sliceMm;
    pageIndex += 1;
    if (pageIndex > 200) throw new Error("PDF page limit exceeded.");
  }

  pdf.save(fileName);
}
