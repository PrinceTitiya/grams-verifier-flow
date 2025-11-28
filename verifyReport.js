import crypto from "crypto";
import { ethers } from "ethers";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { PNG } from "pngjs";
import jsqr from "jsqr";

dotenv.config();

// Load ABI 
const ABI_PATH = path.resolve("ABI/grams-v1.json");
if (!fs.existsSync(ABI_PATH)) throw new Error(`ABI not found → ${ABI_PATH}`);
const ABI = JSON.parse(fs.readFileSync(ABI_PATH, "utf8"));

async function parseQR(filePath) {
  const buffer = fs.readFileSync(filePath);
  const png = PNG.sync.read(buffer);
  const qr = jsqr(png.data, png.width, png.height);

  if (!qr) throw new Error("QR decode failed");
  return JSON.parse(qr.data);
}

function loadJobFromFile(jobId) {
  const p = path.resolve(`jobs/${jobId}.json`);
  if (!fs.existsSync(p)) throw new Error(`Job file missing → ${p}`);
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

async function generateResultsHash(resultsData) {
  const rawJsonText = JSON.stringify(resultsData, null, 2).trim();

  const csvUrls = [
    resultsData.results?.cumulative_analysis_csv,
    resultsData.results?.particle_distribution_csv,
    resultsData.results?.rejection_analysis_display_csv,
  ].filter(Boolean);

  const csvFetches = csvUrls.map(async (url) => {
    const res = await fetch(url);
    const text = await res.text();
    return `\n\n# Source: ${url}\n${text}`;
  });

  const csvData = (await Promise.all(csvFetches)).join("");
  const normalized = (rawJsonText + csvData).replace(/\r\n/g, "\n").trim();

  return (
    "0x" +
    crypto.createHash("sha256").update(normalized, "utf8").digest("hex")
  );
}

function formatTimestamp(unix) {
  if (!unix) return "N/A";
  const date = new Date(Number(unix) * 1000);

  return date.toLocaleString("en-US", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,   // <-- ENABLE AM/PM
  });
}




// Main Verification
async function main() {
  try {
    console.log("Starting Verification...\n");

    // Finding QR
    const qrFiles = fs.readdirSync("qr").filter((f) => f.endsWith(".png"));
    if (!qrFiles.length) throw new Error("No QR file found.");

    const qrFile = path.join("qr", qrFiles[0]);
    console.log(`Reading QR file: ${qrFile}`);

    // Decoding uploaded QR 
    const { jobId, txHash } = await parseQR(qrFile);

    console.log(`QR Decoded → jobId: ${jobId}`);
    console.log(`Transaction Hash: ${txHash}\n`);

    // loding the jobId to fetch jobData
    const jobData = loadJobFromFile(jobId);

    // Compute local hash
    const localHash = await generateResultsHash(jobData);

    // Connect blockchain
    const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
    const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

    const contract = new ethers.Contract(
      process.env.ProxyContract_localhost,
      ABI,
      wallet
    );

    // Fetch on-chain report entries
    const reports = await contract.getReports(jobId);

    const match = reports.find(
      (r) => r.reportHash.toLowerCase() === localHash.toLowerCase()
    );

    // SUCCESS CASE
    if (match) {
      console.log("––––––––––––––––––––––––––––––");
      console.log("✅ Verified on Blockchain");
      console.log("––––––––––––––––––––––––––––––");
      console.log(`Job ID: ${match.jobId}`);
      console.log(`Product: ${match.productName}`);
      console.log(`Analyst: ${match.username}`);
      console.log(`Stored At: ${formatTimestamp(match.timestamp)}`);

      console.log("––––––––––––––––––––––––––––––");
      console.log("Report hash matches the blockchain.");
      console.log("No tampering detected.");
      console.log("––––––––––––––––––––––––––––––\n");
    }


    // FAILURE CASE
    else {
      console.log("––––––––––––––––––––––––––––––");
      console.log("🚫Verification Failed");
      console.log("––––––––––––––––––––––––––––––");
      console.log(`Job ID: ${jobId}`);
      console.log("\nLocal Hash:");
      console.log(localHash);
      console.log("\nOn-Chain Hashes:");
      reports.forEach((r, i) => console.log(`${i + 1}. ${r.reportHash}`));
      console.log("––––––––––––––––––––––––––––––");
      console.log("Hash mismatch detected.");
      console.log("Report may have been modified.");
      console.log("––––––––––––––––––––––––––––––\n");
    }
  } catch (err) {
    console.log("\nERROR:", err.message);
  }
}

main();
