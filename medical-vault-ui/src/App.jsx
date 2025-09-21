import React, { useEffect, useMemo, useState } from "react";
import { ethers } from "ethers";
import vaultArtifact from "./abi/MedicalRecordVaultXRPL.json";

const CONTRACT_ADDRESS = import.meta.env.VITE_VAULT_ADDRESS?.trim();
const COSTON2 = {
  chainIdHex: "0x72", // 114
  rpcUrl: import.meta.env.VITE_COSTON2_RPC || "https://coston2-api.flare.network/ext/C/rpc",
  chainName: "Flare Coston2",
  nativeCurrency: { name: "FLR", symbol: "FLR", decimals: 18 },
  blockExplorerUrls: ["https://coston2-explorer.flare.network/"],
};

const kinds = [
  { v: 0, label: "Diagnosis Letter" },
  { v: 1, label: "Referral" },
  { v: 2, label: "Intake" },
];

// helpers to make hex safe
function zeroHex(bytes) {
  return "0x" + "00".repeat(bytes);
}
function asHexOr(defaultHex, v) {
  const t = (v || "").trim();
  if (!t) return defaultHex;                             // empty -> default
  if (/^0x[0-9a-fA-F]*$/.test(t)) return t;              // already 0x-hex
  if (/^[0-9a-fA-F]*$/.test(t)) return "0x" + t;         // raw hex -> add 0x
  // otherwise treat as utf8 and hexlify
  return ethers.hexlify(ethers.toUtf8Bytes(t));
}

export default function App() {
  const [status, setStatus] = useState("Click Connect");
  const [account, setAccount] = useState("");
  const [contract, setContract] = useState(null);

  // patient
  const [mrn, setMrn] = useState("");
  const [salt, setSalt] = useState("");
  const [patientId, setPatientId] = useState("");

  // upload
  const [kind, setKind] = useState(0);
  const [hashURI, setHashURI] = useState("");
  const [statementId, setStatementId] = useState("");
  const [proofId, setProofId] = useState("");
  const [xrplProofHex, setXrplProofHex] = useState("");
  // ensure > 0 by default for UI testing (1 XRP in drops)
  const [xrplPaidDrops, setXrplPaidDrops] = useState("1000000");

  // read result
  const [doc, setDoc] = useState(null);

  // insurer portal
  const [insurerXRPL, setInsurerXRPL] = useState("");
  const [insurerContact, setInsurerContact] = useState("");
  const [insurerInfo, setInsurerInfo] = useState(null);

  // pricing
  const [requiredDrops, setRequiredDrops] = useState("");
  const [priceInfo, setPriceInfo] = useState(null);

  // auto-compute patientId = keccak256(`${mrn}|${salt}`)
  const patientIdComputed = useMemo(() => {
    try {
      if (!mrn && !salt) return "";
      return ethers.keccak256(ethers.toUtf8Bytes(`${mrn}|${salt}`));
    } catch {
      return "";
    }
  }, [mrn, salt]);

  useEffect(() => {
    if (patientIdComputed) setPatientId(patientIdComputed);
  }, [patientIdComputed]);

  async function connect() {
    if (!window.ethereum) {
      setStatus("Install MetaMask");
      return;
    }
    try {
      // switch or add Coston2
      try {
        await window.ethereum.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: COSTON2.chainIdHex }],
        });
      } catch {
        await window.ethereum.request({
          method: "wallet_addEthereumChain",
          params: [{
            chainId: COSTON2.chainIdHex,
            chainName: COSTON2.chainName,
            rpcUrls: [COSTON2.rpcUrl],
            nativeCurrency: COSTON2.nativeCurrency,
            blockExplorerUrls: COSTON2.blockExplorerUrls,
          }],
        });
      }

      await window.ethereum.request({ method: "eth_requestAccounts" });
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const addr = await signer.getAddress();
      const net = await provider.getNetwork();
      if (Number(net.chainId) !== 114) {
        setStatus("Wrong network (need Coston2)");
        return;
      }

      if (!CONTRACT_ADDRESS) {
        setStatus("Set VITE_VAULT_ADDRESS in .env");
        setAccount(addr);
        return;
      }

      const c = new ethers.Contract(CONTRACT_ADDRESS, vaultArtifact.abi, signer);
      setContract(c);
      setAccount(addr);
      setStatus(`Connected: ${addr.slice(0,6)}…${addr.slice(-4)}`);

      // fetch required drops; fall back to 1,000,000 if unavailable
      try {
        const res = await c.requiredXrpDrops(); // (drops, price, decimals, ts)
        const dropsStr = res[0].toString();
        const price = res[1];
        const dec = Number(res[2]);
        const ts = Number(res[3]);
        setRequiredDrops(dropsStr);
        setPriceInfo({ price: price.toString(), decimals: dec, ts });

        setXrplPaidDrops(dropsStr === "0" ? "1000000" : dropsStr);
      } catch (e) {
        console.warn("requiredXrpDrops() failed; defaulting xrplPaidDrops=1,000,000", e);
        setRequiredDrops("0");
        setXrplPaidDrops("1000000");
      }
    } catch (e) {
      console.error(e);
      setStatus(e?.message || "Failed to connect");
    }
  }

  async function upload() {
    if (!contract) return alert("Connect first");
    if (!patientId || hashURI.trim() === "") return alert("patientId & hashURI required");

    try {
      const paid = BigInt(xrplPaidDrops && xrplPaidDrops !== "0" ? xrplPaidDrops : "1000000");

      // sanitize hex/bytes inputs
      const proofBytes   = asHexOr("0x", xrplProofHex);     // bytes
      const statementHex = asHexOr(zeroHex(32), statementId); // bytes32
      const proofIdHex   = asHexOr(zeroHex(32), proofId);     // bytes32

      const tx = await contract.uploadDocumentXRP(
        patientId,
        Number(kind),
        hashURI.trim(),
        proofBytes,
        statementHex,
        proofIdHex,
        paid.toString()
      );
      await tx.wait();
      alert("✅ Uploaded!");
    } catch (e) {
      console.error(e);
      alert(e?.reason || e?.message || "Upload failed");
    }
  }

  async function readDoc() {
    if (!contract) return alert("Connect first");
    if (!patientId) return alert("patientId required");
    try {
      const res = await contract.getDocument(patientId, Number(kind));
      setDoc({
        hashURI: res[0],
        version: Number(res[1]),
        updatedAt: new Date(Number(res[2]) * 1000).toLocaleString(),
        paymentProof: res[3],
      });
    } catch (e) {
      console.error(e);
      alert(e?.reason || e?.message || "Read failed (unpaid/empty?)");
    }
  }

  async function setInsurerPortal() {
    if (!contract) return alert("Connect first");
    try {
      const tx = await contract.setInsurerInfo(
        patientId,
        insurerXRPL.trim(),
        insurerContact.trim() || ethers.ZeroAddress
      );
      await tx.wait();
      alert("✅ Insurer info set");
    } catch (e) {
      console.error(e);
      alert(e?.reason || e?.message || "Set insurer info failed");
    }
  }

  async function loadInsurerPortal() {
    if (!contract) return alert("Connect first");
    try {
      const res = await contract.getInsurerInfo(patientId);
      setInsurerInfo({ xrpl: res[0], contact: res[1] });
    } catch (e) {
      console.error(e);
      alert(e?.reason || e?.message || "Load insurer info failed");
    }
  }

  return (
    <div style={{ padding: 20, fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif", maxWidth: 980, margin: "0 auto", color: "#eee", background: "#1f1f1f", minHeight: "100vh" }}>
      <header style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
        <h2 style={{ margin: 0 }}>Medical Vault</h2>
        <button onClick={connect} style={{ padding: "6px 10px" }}>Connect</button>
        <span style={{ opacity: 0.8 }}>{status}</span>
        {requiredDrops !== "" && (
          <span style={{ marginLeft: "auto", opacity: 0.8 }}>
            Required: <b>{requiredDrops}</b> drops
          </span>
        )}
      </header>

      {/* Patient */}
      <section style={{ background: "#2a2a2a", borderRadius: 12, padding: 16, marginBottom: 16 }}>
        <h3 style={{ marginTop: 0 }}>Patient Information</h3>
        <div style={{ display: "grid", gap: 8, gridTemplateColumns: "1fr 1fr", marginBottom: 8 }}>
          <input placeholder="MRN" value={mrn} onChange={(e)=>setMrn(e.target.value)} />
          <input placeholder="Salt (for privacy)" value={salt} onChange={(e)=>setSalt(e.target.value)} />
        </div>
        <input style={{ width: "100%" }} value={patientId} onChange={(e)=>setPatientId(e.target.value)} placeholder="0x… bytes32 patientId (auto-filled from MRN|salt)" />
      </section>

      {/* Upload */}
      <section style={{ background: "#2a2a2a", borderRadius: 12, padding: 16, marginBottom: 16 }}>
        <h3 style={{ marginTop: 0 }}>Upload (XRP proof required)</h3>
        <div style={{ display: "grid", gap: 8, gridTemplateColumns: "1fr 1fr" }}>
          <select value={kind} onChange={(e)=>setKind(Number(e.target.value))}>
            {kinds.map(k => <option key={k.v} value={k.v}>{k.label}</option>)}
          </select>
          <input placeholder="Encrypted hash URI (IPFS/S3)" value={hashURI} onChange={(e)=>setHashURI(e.target.value)} />
          <input placeholder="statementId (0x…32) — bound off-chain" value={statementId} onChange={(e)=>setStatementId(e.target.value)} />
          <input placeholder="proofId (0x…32) — XRPL tx id hash" value={proofId} onChange={(e)=>setProofId(e.target.value)} />
          <input placeholder="FDC proof bytes (0x…)" value={xrplProofHex} onChange={(e)=>setXrplProofHex(e.target.value)} />
          <input placeholder="xrplPaidDrops (integer)" value={xrplPaidDrops} onChange={(e)=>setXrplPaidDrops(e.target.value)} />
        </div>
        <div style={{ marginTop: 8 }}>
          <button onClick={upload}>Upload Document</button>
        </div>
        <p style={{ opacity: 0.7, marginTop: 8 }}>
          Tip: compute <code>statementId</code> off-chain (e.g., <code>keccak256(patientId|kind|hashURI|payer|expiry)</code>).
          Your verifier (FDC) must return a proof that makes <code>verify(proof, statementId)</code> true.
        </p>
      </section>

      {/* Read */}
      <section style={{ background: "#2a2a2a", borderRadius: 12, padding: 16, marginBottom: 16 }}>
        <h3 style={{ marginTop: 0 }}>Download / Read</h3>
        <div style={{ display: "flex", gap: 8 }}>
          <select value={kind} onChange={(e)=>setKind(Number(e.target.value))}>
            {kinds.map(k => <option key={k.v} value={k.v}>{k.label}</option>)}
          </select>
          <button onClick={readDoc}>Get Document</button>
        </div>
        {doc && (
          <div style={{ marginTop: 8, background: "#222", padding: 10, borderRadius: 8 }}>
            <div><b>Hash URI:</b> {doc.hashURI}</div>
            <div><b>Version:</b> {doc.version}</div>
            <div><b>Updated:</b> {doc.updatedAt}</div>
            <div><b>Payment Proof:</b> {doc.paymentProof}</div>
          </div>
        )}
      </section>

      {/* Insurer Portal */}
      <section style={{ background: "#2a2a2a", borderRadius: 12, padding: 16 }}>
        <h3 style={{ marginTop: 0 }}>Insurer Portal</h3>
        <div style={{ display: "grid", gap: 8, gridTemplateColumns: "2fr 1fr" }}>
          <input placeholder="Insurer XRPL account (r... / X-address)" value={insurerXRPL} onChange={(e)=>setInsurerXRPL(e.target.value)} />
          <input placeholder="Insurer EVM contact (0x...)" value={insurerContact} onChange={(e)=>setInsurerContact(e.target.value)} />
        </div>
        <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
          <button onClick={setInsurerPortal}>Admin: Save Insurer Info (owner)</button>
          <button onClick={loadInsurerPortal}>View Insurer Info</button>
        </div>
        {insurerInfo && (
          <div style={{ marginTop: 8, background: "#222", padding: 10, borderRadius: 8 }}>
            <div><b>XRPL Account:</b> {insurerInfo.xrpl || "—"}</div>
            <div><b>EVM Contact:</b> {insurerInfo.contact}</div>
          </div>
        )}
      </section>

      {priceInfo && (
        <p style={{ opacity: 0.6, marginTop: 12 }}>
          Price feed: USD/XRP = {priceInfo.price} (decimals {priceInfo.decimals}), ts {priceInfo.ts}
        </p>
      )}
    </div>
  );
}
