

#  **Local Simulation Environment — On-Chain Report Writer + QR Generator + Verifier**

This repository provides a **complete end-to-end offline simulation** of production traceability workflow.

It mirrors exactly how your AWS Lambda + Hedera integration will function — but runs **entirely locally** using a Hardhat blockchain.

---

#  **What This Simulation Does**

This system allows you to:

### **1. Hash a jobData(grain-analysis report)**

Including embedded CSVs and metadata
→ Using the same hashing algorithm your Lambda function will use.

### **2. Store the hash on-chain**

Using your **upgradeable proxy smart contract** deployed on a local Hardhat node.

### **3. Generate a QR code**

Containing `{ jobId, txHash }`.
This QR represents a **tamper-proof proof of authenticity** for the stored report.

### **4. Verify authenticity by scanning the QR**

The verifier will:

✔ Decode QR → extract jobId
✔ Load the corresponding `jobs/<jobId>.json` report
✔ Recompute the exact same hash
✔ Fetch stored reports from the smart contract
✔ Compare hashes → **Authentic / Tampered** result

---

#  **Folder Structure**

```
local-simulation/
│
├── ABI/
│   └── grams-v1.json           # Pure ABI array of deployed contract
│
├── jobs/
│   └── <jobId>.json             # Input grain-analysis report
│
├── qr/
│   └── job-<jobId>.png          # Auto-generated QR code after writing
│
├── onChainWriter.js             # Simulates hashOnchainRecord Lambda
├── qrGenerator.js               # Generates QR codes (used inside writer)
├── verifyReport.js              # Simulates verifyHashRecord Lambda
│
├── package.json
└── .env
```

---

#  **Environment Variables (`.env`)**

```
RPC_URL=http://127.0.0.1:8545
PRIVATE_KEY= <your hardhat account private key>
ProxyContract_localhost= <your deployed proxy contract address>
SAMPLE_JOB_ID=649223be-d198-40f1-b5ab-ec200b43941b
```

### Important Notes

* `PRIVATE_KEY` must be from your **local Hardhat node**
* `ProxyContract_localhost` must be the **proxy address from your Hardhat deployment**
* `SAMPLE_JOB_ID` must match a `.json` file inside `/jobs`

---

#  **1. Hash Generation Logic (Core of the System)**

Both **onChainWriter.js** and **verifyReport.js** use *identical hashing logic*:

### Steps:

1. Convert `jobId.json` into normalized JSON
2. Fetch embedded CSVs:

   * cumulative_analysis_csv
   * particle_distribution_csv
   * rejection_analysis_display_csv
3. Combine JSON + CSV contents
4. Normalize line endings (`\n`)
5. Generate SHA-256 hash:

```js
"0x" + crypto.createHash("sha256")
             .update(normalizedData, "utf8")
             .digest("hex");
```

### Why this matters

This ensures **verification always matches the original write**, preventing false positives during authenticity checks.

---

#  **2. onChainWriter.js — Store Report On-Chain**

This script simulates the **hashOnchainRecord Lambda**:

### It performs:

1. Load `jobs/<jobId>.json`
2. Generate hash using JSON + CSV data
3. Connect to local Hardhat blockchain via ethers.js
4. Call your upgradeable contract:

```solidity
storeReport(jobId, reportHash, productName, username)
```

5. Fetch the newly stored on-chain record
6. Generate a QR code containing:

```json
{
  "jobId": "<jobId>",
  "txHash": "<transaction_hash>"
}
```

Saved to:

```
qr/job-<jobId>.png
```

---

##  **Run On-Chain Writer**

```
npm run write
```

This will:

✔ Hash your job report  
✔ Store report in your contract  
✔ Generate QR code automatically

---

#  **3. qrGenerator.js — QR Code Module**

`qrGenerator.js` is a reusable QR module that:

* Accepts `{ jobId, txHash }`
* Serializes into JSON
* Generates a QR PNG file
* Stores it inside `/qr`

Used internally by the writer —should be modular for reuse later as real Lambda.

---

# **4. verifyReport.js — Full Authenticity Verification**

This script simulates the **verifyHashRecord Lambda** used by users to confirm report integrity.

### Verification Steps:

---

### **Step 1 — Read QR**

Decode PNG → extract jobId + txHash:

```js
const { jobId, txHash } = await parseQR("qr/job-<jobId>.png");
```

---

### **Step 2 — Load matching report file**

Loads:

```
jobs/<jobId>.json
```

---

### **Step 3 — Recompute SHA-256 hash**

Uses identical logic as writer.

---

### **Step 4 — Fetch on-chain records**

Your contract supports **multiple historical reports** under the same jobId.

This script fetches them all:

```js
const reports = await contract.getReports(jobId);
```

---

### **Step 5 — Hash comparison**

Checks if **any** on-chain reportHash matches the recomputed hash.

#### If matched:

```
✅ Verified on Blockchain
Hash matches. No tampering detected.
```

Shows timestamp, analyst, productName, stored value.

#### If failed:

```
🚫 Verification Failed
Local hash does not match any on-chain entry.
Report may have been modified.
```

---

##  **Run Verifier**

```
npm run verify
```

---

# **End-to-End Flow Summary**

| Step | Script             | Purpose                                      |
| ---- | ------------------ | -------------------------------------------- |
| 1    | `onChainWriter.js` | Hash → Write → Generate QR                   |
| 2    | `verifyReport.js`  | Decode QR → Recompute Hash → Verify on-chain |
| 3    | Result             | Authentic OR Tampered                        |

---

#  **Setup & Installation**

## 1. Clone Repo

```
git clone https://github.com/PrinceTitiya/grams-verifier-flow.git
cd grams-verifier-flow
```

---

## 2. Install Dependencies

```
npm install
```

---

## 3. Start Local Blockchain (in smart-contract repo)

In **your smart contract codebase**:

```
npx hardhat node
```

or

```
npm run node
```

---

## 4. Deploy V1 Contract

Still inside smart-contract repo:

```
npm run deploy-v1
```

Copy the **proxy address** into `.env` of this simulation.

---

## 5. Configure `.env`

Example:

```
RPC_URL=http://127.0.0.1:8545
PRIVATE_KEY=0x...
ProxyContract_localhost=0x...
SAMPLE_JOB_ID=649223be-d198-40f1-b5ab-ec200b43941b
```

---

# ▶ **Run Everything**

### **Write Report to Blockchain**

```
npm run write
```

### **Verify Report Authenticity**

```
npm run verify
```

---

#  **Summary**

1.  When a new grain-analysis `jobId.json` is generated →
**onChainWriter.js** hashes it and stores that hash on-chain.

2. The writer then produces a **QR code** containing `{ jobId, txHash }`.

33.  When verification is needed →
A user scans the QR and **verifyReport.js**:

* Extracts jobId from the QR
* Recomputes the hash jobData of fetched jobId
* Fetches all reports stored on-chain for that jobId
* Compares the hashes

4. If hashes match → report is **authentic**.  
If not → **tampering or mismatch detected**.
