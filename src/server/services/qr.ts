import "server-only";
import QRCode from "qrcode";

const options = { errorCorrectionLevel: "M" as const, margin: 2, color: { dark: "#171513", light: "#ffffff" } };

export async function qrSvg(url: string): Promise<string> {
  return QRCode.toString(url, { ...options, type: "svg" });
}

export async function qrPngDataUrl(url: string, width = 1024): Promise<string> {
  return QRCode.toDataURL(url, { ...options, width });
}
