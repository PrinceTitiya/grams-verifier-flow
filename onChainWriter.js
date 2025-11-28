import crypto from "crypto";
import { ethers } from "ethers";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { generateQR } from "./qrGenerator.js";

dotenv.config();

// load the abi
const ABI_PATH = path.resolve("ABI/grams-v1.json");
if (!fs.existsSync(ABI_PATH)) throw new Error(`ABI not found → ${ABI_PATH}`);

const ABI = JSON.parse(fs.readFileSync(ABI_PATH, "utf8"));
if (!Array.isArray(ABI)) throw new Error("ABI must be a pure JSON array");

// loading the jobData
function loadLocalJob(jobId) {
  const JOB_PATH = path.resolve(`jobs/${jobId}.json`);
  if (!fs.existsSync(JOB_PATH)) {
    throw new Error(`Job JSON not found → ${JOB_PATH}`);
  }
  return JSON.parse(fs.readFileSync(JOB_PATH, "utf8"));
}

// Hash Generator
async function generateResultsHash(resultsData) {
  const rawJsonText = JSON.stringify(resultsData, null, 2).trim();

  const csvUrls = [
    resultsData.results?.cumulative_analysis_csv,
    resultsData.results?.particle_distribution_csv,
    resultsData.results?.rejection_analysis_display_csv,
  ].filter(Boolean);

  const csvFetches = csvUrls.map(async (url) => {
    try {
      const res = await fetch(url);
      const csvText = (await res.text()).trim();
      return `\n\n# Source: ${url}\n${csvText}`;
    } catch {
      return `\n\n# Source: ${url}\n# Fetch failed`;
    }
  });

  const csvTextCombined = (await Promise.all(csvFetches)).join("");
  const normalizedData = (rawJsonText + csvTextCombined).replace(/\r\n/g, "\n").trim();

  return (
    "0x" +
    crypto.createHash("sha256").update(normalizedData, "utf8").digest("hex")
  );
}

// Main 
export const handler = async () => {
  try {
    const SAMPLE_JOB_ID = process.env.SAMPLE_JOB_ID; // set in .env
    const jobData = loadLocalJob(SAMPLE_JOB_ID);

    const { jobId, username, productName } = jobData;

    const reportHash = await generateResultsHash(jobData);

    const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
    const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

    const contract = new ethers.Contract(
      process.env.ProxyContract_localhost,
      ABI,
      wallet
    );

    console.log(`🔥 Writing report to blockchain for jobId: ${jobId}`);

    const tx = await contract.storeReport(jobId, reportHash, productName, username);
    const receipt = await tx.wait();

    console.log("\n----------------------------------------");
    console.log("✔ TRANSACTION SUCCESSFUL");
    console.log(" txHash:", receipt.hash);
    console.log("----------------------------------------\n");

    // FETCH BACK EXACT ON-CHAIN DATA THAT WAS STORED
    const reports = await contract.getReports(jobId);
    const last = reports[reports.length - 1];

    console.log("📦 ON-CHAIN STORED REPORT");
    console.log("----------------------------------------");
    console.log(" jobId:        ", last.jobId);
    console.log(" username:     ", last.username);
    console.log(" productName:  ", last.productName);
    console.log(" uploadedBy:   ", last.uploadedBy);
    console.log(" timestamp:    ", Number(last.timestamp));
    console.log(" reportHash:   ", last.reportHash);
    console.log("----------------------------------------\n");

    // Generate QR
    await generateQR(jobId, receipt.hash);

  } catch (err) {
    console.error("❌ Error:", err.message);
  }
};

handler();
