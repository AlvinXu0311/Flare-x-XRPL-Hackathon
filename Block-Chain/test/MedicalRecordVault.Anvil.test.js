const { toBN, toWei, fromWei, soliditySha3 } = web3.utils;

// If your contract name differs, adjust here:
const Vault = artifacts.require("MedicalRecordVault");

contract("MedicalRecordVault (Anvil)", (accounts) => {
  const [owner, insurer, parent, accessor1, accessor2, stranger] = accounts;

  // handy constants
  const FEE_WEI = toBN(toWei("0.0001", "ether")); // default in your contract; can tweak via setAccessFee
  const DEPOSIT_WEI = toBN(toWei("0.01", "ether"));
  const URI1 = "ipfs://QmCID-diagnosis-v1";
  const URI2 = "ipfs://QmCID-diagnosis-v2";
  const URI3 = "ipfs://QmCID-referral-v1";

  let vault;
  let PID; // bytes32 patient id

  before(async () => {
    // Derive a bytes32 patient id off-chain
    PID = soliditySha3("mrn-12345", "salt-xyz");
  });

  beforeEach(async () => {
    vault = await Vault.new({ from: owner });

    // (Optional) explicitly set fee/collector to known values for deterministic tests
    // await vault.setAccessFee(FEE_WEI, owner, { from: owner });

    // Setup patient controls & payer
    await vault.setParent(PID, parent, { from: owner });
    await vault.setInsurer(PID, insurer, { from: owner });
  });

  it("grants access (single) + uploads and charges insurer on read", async () => {
    // Parent grants accessor1 read permission
    await vault.grantAccess(PID, accessor1, true, { from: parent });

    // Insurer funds deposit for this patient
    await vault.depositFor(PID, { from: insurer, value: DEPOSIT_WEI });

    // Parent uploads a record pointer (e.g., encrypted IPFS CID)
    await vault.uploadRecord(PID, URI1, { from: parent });

    // Sanity: read meta before paid read
    const metaBefore = await vault.getRecordMeta(PID);
    // metaBefore returns (hashURI, version, updatedAt, parent, insurer)
    assert.equal(metaBefore.parent, parent, "parent mismatch");
    assert.equal(metaBefore.insurer, insurer, "insurer mismatch");
    assert.equal(metaBefore.hashURI, URI1, "hash URI mismatch at v1");
    assert.equal(metaBefore.version.toString(), "1", "version should be 1");

    // Check insurer balance BEFORE read
    const balBefore = await vault.insurerBalances(insurer);

    // Accessor1 reads the document; this should deduct access fee from insurer
    const rec = await vault.getRecord(PID, { from: accessor1 });
    assert.equal(rec.hashURI, URI1, "getRecord hashURI mismatch");
    assert.equal(rec.version.toString(), "1", "getRecord version mismatch");
    assert.ok(rec.updatedAt.toNumber() > 0, "updatedAt should be set");

    // Verify fee deduction = accessFeeWei
    const balAfter = await vault.insurerBalances(insurer);
    const diff = toBN(balBefore).sub(toBN(balAfter));
    assert.equal(diff.toString(), FEE_WEI.toString(), "insurer not charged correctly");
  });

  it("reverts read if caller not allowed", async () => {
    await vault.depositFor(PID, { from: insurer, value: DEPOSIT_WEI });
    await vault.uploadRecord(PID, URI1, { from: parent });

    try {
      await vault.getRecord(PID, { from: stranger });
      assert.fail("stranger must not be allowed");
    } catch (err) {
      // expect revert reason contains "not allowed"
      assert(
        `${err}`.includes("not allowed"),
        `unexpected revert message: ${err}`
      );
    }
  });

  it("batch grants, second upload, and multiple reads burn multiple fees", async () => {
    // Batch grant by parent
    await vault.grantAccessBatch(PID, [accessor1, accessor2], true, { from: parent });

    // Fund insurer
    await vault.depositFor(PID, { from: insurer, value: DEPOSIT_WEI });

    // First upload
    await vault.uploadRecord(PID, URI1, { from: parent });

    // accessor1 read -> -1 fee
    await vault.getRecord(PID, { from: accessor1 });

    // Update record (version 2)
    await vault.uploadRecord(PID, URI2, { from: parent });

    // accessor2 read -> -1 fee
    const balBefore = await vault.insurerBalances(insurer);
    await vault.getRecord(PID, { from: accessor2 });
    const balAfter = await vault.insurerBalances(insurer);

    // One more fee charged
    assert.equal(
      toBN(balBefore).sub(toBN(balAfter)).toString(),
      FEE_WEI.toString(),
      "second read should cost one more fee"
    );

    const meta = await vault.getRecordMeta(PID);
    assert.equal(meta.hashURI, URI2, "meta should be latest URI (v2)");
    assert.equal(meta.version.toString(), "2", "version should be 2");
  });

  it("only parent/owner can grant and upload", async () => {
    // Stranger tries to grant -> revert
    try {
      await vault.grantAccess(PID, accessor1, true, { from: stranger });
      assert.fail("stranger cannot grant");
    } catch (err) {
      assert(`${err}`.includes("not parent/owner"), "expected not parent/owner");
    }

    // Stranger tries to upload -> revert
    try {
      await vault.uploadRecord(PID, URI1, { from: stranger });
      assert.fail("stranger cannot upload");
    } catch (err) {
      assert(`${err}`.includes("not permitted"), "expected not permitted");
    }
  });

  it("owner can change fee and collector", async () => {
    // Change fee to 0.0002 ether and collector to owner
    const newFee = toBN(toWei("0.0002", "ether"));
    await vault.setAccessFee(newFee, owner, { from: owner });

    const after = await vault.accessFeeWei();
    assert.equal(after.toString(), newFee.toString(), "fee not updated");
  });

  it("withdraw by owner works", async () => {
    // Deposit to contract by sending directly (receive) or via insurer + fee forwarding;
    // Here we simulate a direct donation then withdraw.
    const donate = toBN(toWei("0.005", "ether"));
    await web3.eth.sendTransaction({ from: owner, to: vault.address, value: donate });

    const contractBalBefore = toBN(await web3.eth.getBalance(vault.address));
    assert.equal(contractBalBefore.toString(), donate.toString(), "donation not received");

    // Withdraw a portion
    const pull = toBN(toWei("0.002", "ether"));
    await vault.withdraw(owner, pull, { from: owner });

    const contractBalAfter = toBN(await web3.eth.getBalance(vault.address));
    assert.equal(
      contractBalBefore.sub(contractBalAfter).toString(),
      pull.toString(),
      "withdraw amount mismatch"
    );
  });

  it("insurer must pre-deposit or reads revert for low balance", async () => {
    await vault.uploadRecord(PID, URI3, { from: parent });
    await vault.grantAccess(PID, accessor1, true, { from: parent });

    try {
      await vault.getRecord(PID, { from: accessor1 });
      assert.fail("should revert due to low insurer balance");
    } catch (err) {
      assert(`${err}`.includes("insurer balance low"), "expected insurer balance low");
    }
  });
});
