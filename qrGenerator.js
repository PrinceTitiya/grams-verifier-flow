import fs from "fs";
import path from "path";
import QRCode from "qrcode";

/**
 * Generates a QR code PNG containing { jobId, txHash }
 * Saves into ./qr/ directory.
 */
export async function generateQR(jobId, txHash) {
  const qrPayload = { jobId, txHash };
  const qrDir = path.resolve("qr");

  // Ensure directory exists
  if (!fs.existsSync(qrDir)) {
    fs.mkdirSync(qrDir, { recursive: true });
  }

  const filePath = path.join(qrDir, `job-${jobId}.png`);

  await QRCode.toFile(filePath, JSON.stringify(qrPayload), {
    width: 300,
    margin: 2
  });

  console.log(` QR Code saved → ${filePath}`);
  return filePath;
}
