
#  **Local Simulation Environment — On-Chain Report Writer + qrGenerator + Verifier**

This  repo provides a **full offline testing environment** that simulates how system will:

1. **Generate a SHA-256 hash** for a grain-analysis report
2. **Store the hash on-chain** in  upgradeable Smart Contract
3. **Generate a tamper-proof QR code** containing `{ jobId, txHash }`
4. **Verify authenticity offline** by:

   * Fetching jobId from QR and fetch JobData accordingly
   * Recomputing the hash of data
   * Fetching all on-chain hashes for the jobId
   * Comparing them for a match


This simulation mirrors how your future AWS Lambda functions will work — but runs **entirely locally** with  Hardhat localhost blockchain.

---

#  Folder Structure

```
local-simulation/
│
├── ABI/
│   └── grams-v1.json             # Pure ABI array copied from ./artifacts of smart-contract codebase
│
├── jobs/
│   └── <jobId>.json              # Input sample jobData
│
├── qr/
│   └── job-<jobId>.png           # Auto-generated QR (after write)
│
├── onChainWriter.js              #  hashOnchainRecord lambda
├── qrGenerator.js                #  generates QR codes for jobId/txHash
├── verifyReport.js               #  verifyHashRecord lambda
│
├── package.json
└── .env
```

---

# ⚙️ **Environment Variables (`.env`)**

```
RPC_URL=http://127.0.0.1:8545
PRIVATE_KEY= <your-localhost-private-key>
ProxyContract_localhost= <deployed-proxy-address>
SAMPLE_JOB_ID=649223be-d198-40f1-b5ab-ec200b43941b 
```

Make sure:

* PRIVATE_KEY is from Hardhat local accounts
* ProxyContract_localhost is your deployed proxy contract

---

#  **1. Report Hash Generation Logic**

Both onChainWriter.js and verifyReport.js share the SAME hashing logic:

###  Extract report JSON

###  Fetch 3 CSVs:

* cumulative_analysis_csv
* particle_distribution_csv
* rejection_analysis_display_csv

###  Normalize line endings (`\n`)

###  Merge JSON + CSV

###  Hash using SHA-256

```js
"0x" + crypto.createHash("sha256")
             .update(normalizedData, "utf8")
             .digest("hex")
```

**Important:**
This ensures **Server-side (Lambda)** and **client-side verification** always use the exact same hashing method → guaranteeing authenticity.

---

#  **2. onChainWriter.js — Write Report On-Chain**

This script:

### 1 Loads ABI

### 2 Loads jobData from `jobs/<jobId>.json`

### 3 Generates hash using full JSON + CSV contents

### 4 Connects to the local blockchain (Hardhat RPC)

### 5 Writes report on-chain via:

```solidity
storeReport(jobId, reportHash, productName, username)
```

### 6 Fetches the newly updated on-chain entry

### 7 Generates a QR Code containing:

```json
{
  "jobId": "...",
  "txHash": "0x..."
}
```

Stored at:

```
qr/job-<jobId>.png
```

###  **Run:**

```
npm run write
```

---

#  **3. QR Code Generation (qrGenerator.js)**

If extracted into a module, `qrGenerator.js`:

* Accepts `{ jobId, txHash }`
* Produces a QR PNG file under `/qr`
* Used later during verification

It uses:

```js
QRCode.toFile("qr/job-<jobId>.png", qrPayload);
```

---

#  **4. verifyReport.js — Full Local Verification**

The verifier performs **complete authenticity testing**:

---

### 🔍 Step 1: Decode QR

```js
const { jobId, txHash } = parseQR("qr/job-<jobId>.png");
```

---

###  Step 2: Load local JSON again (same data used for writing)

```js
jobData = loadJobFromFile(jobId);
```

---

###  Step 3: Recompute SHA-256 hash

Ensures the local data hasn’t changed.

---

###  Step 4: Fetch ALL on-chain reports for this jobId

```js
const reports = await contract.getReports(jobId);
```

Since your smart-contract allows **multiple historical reports** under the same jobId, we:

* Print all on-chain hashes
* Compare each of them
* Highlight the matched one

---

###  Step 5: Compare → Match or Mismatch

If a match is found:

```
Verified ON-CHAIN
Report hash matches.
No tampering detected.
```

❌ If no match:

```
❌ Verification Failed
Local hash != On-chain hash
Report may have been modified
```

---

#  End-to-End Flow Summary

| Step | Script             | Purpose                                                        |
| ---- | ------------------ | -------------------------------------------------------------- |
| 1    | `onChainWriter.js` | Generate hash → Write on-chain → Generate QR                   |
| 2    | `verifyReport.js`  | Decode QR → Recompute hash → Fetch on-chain → Match comparison |
| 3    | Result             | Authentic report OR tampering detected                         |

---

#  **Why This Simulation Exists**

This environment is designed to perfectly mirror the real AWS Lambda flow:

###  **Further Lambda will:**

* Fetch ABI from S3
* Generate hash from JSON + CSV
* Write to blockchain
* Store txHash back to DynamoDB

###  **The verification Lambda will:**

* Decode QR -> Fetch jobId
* Recompute jobData hash locally
* Fetch on-chain reports 
* Validate integrity

By testing locally, you guarantee:

* Consistent hashing
* Proper smart-contract interactions
* Correct QR verification
* Smooth future integration with AWS

---

#  **How to Run Everything**

## 0 Run the hardhat node in the smart contract-codebase or using the hardhat environment 

```
npm run node / npx hardhat node
```

### 0.0 Deploy the contract
```
npm run deploy-v1
```


## 1 Write Report on Chain

```
npm run write
```

## 2️ Verify Report Authenticity

```
npm run verify
```
