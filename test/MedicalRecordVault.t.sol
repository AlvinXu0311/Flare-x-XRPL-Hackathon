// SPDX-License-Identifier: MIT
pragma solidity ^0.8.21;

import "forge-std/Test.sol";
import "../src/MedicalRecordVault.sol"; // <-- ensure this path matches your file

// Contract under test must be named exactly MedicalRecordVaultXRPL
// inside src/MedicalRecordVault.sol.
contract MedicalRecordVaultTest is Test {
    MedicalRecordVaultXRPL vault;

    // keep addresses simple to avoid forge-std version issues
    address guardian     = address(0x1);
    address psychologist = address(0x2);
    address insurer      = address(0x3);
    address reader       = address(0x4);

    bytes32 patientId;
    uint8 constant KIND_DIAGNOSIS = 0; // enum DocKind.Diagnosis

    string constant HASH_URI = "ipfs://fakeEncryptedPointerQm123";

    function setUp() public {
        vault = new MedicalRecordVaultXRPL();

        // mimic off-chain derived id
        patientId = keccak256(abi.encodePacked("MRN123|salt"));

        // owner (this contract) configures roles
        vault.setGuardian(patientId, guardian);
        vault.setPediatricPsychologist(patientId, psychologist);
        vault.setInsurer(patientId, insurer);
    }

    function testRolesAreSet() public {
        (address g, address p, address i) = vault.getRoles(patientId);
        assertEq(g, guardian);
        assertEq(p, psychologist);
        assertEq(i, insurer);
    }

    function testDepositAndUploadDeduct() public {
        // fund insurer & deposit exactly the fee
        uint256 feeWei = vault.uploadFeeWei();
        vm.deal(insurer, 1 ether);

        vm.prank(insurer);
        vault.depositFor{value: feeWei}(patientId);

        // upload as pediatric psychologist
        vm.prank(psychologist);
        vault.uploadDocumentDeduct(patientId, KIND_DIAGNOSIS, HASH_URI);

        // YOUR current getDocMeta returns (string uri, uint ver, uint updatedAt, bytes32 proof)
        (string memory gotURI, uint256 ver, uint256 updatedAt, bytes32 proof) =
            vault.getDocMeta(patientId, KIND_DIAGNOSIS);

        assertEq(gotURI, HASH_URI);
        assertEq(ver, 1);
        assertGt(updatedAt, 0);
        assertEq(proof, bytes32(0)); // FLR-deduct marker

        // also check getDocPayment shape
        (uint256 paidDrops, uint256 paidVer, bool flareDeduct) =
            vault.getDocPayment(patientId, KIND_DIAGNOSIS);
        // NOTE: if your signature is (paidDrops, paidVer, flareDeduct) this matches;
        // if it differs, adjust the tuple above.
        assertEq(paidDrops, 0);
        assertEq(paidVer, 1);
        assertTrue(flareDeduct);
    }

    function testGuardianGrantsReadAndReaderCanGetDocument() public {
        // make doc payable & uploaded first
        uint256 feeWei = vault.uploadFeeWei();
        vm.deal(insurer, 1 ether);
        vm.prank(insurer);
        vault.depositFor{value: feeWei}(patientId);

        vm.prank(psychologist);
        vault.uploadDocumentDeduct(patientId, KIND_DIAGNOSIS, HASH_URI);

        // guardian grants read to reader
        vm.prank(guardian);
        vault.grantRead(patientId, reader, true);
        assertTrue(vault.hasRead(patientId, reader));

        // reader calls getDocument (same 4-return signature)
        vm.prank(reader);
        (string memory uri, uint256 ver, uint256 updatedAt, bytes32 proof) =
            vault.getDocument(patientId, KIND_DIAGNOSIS);

        assertEq(uri, HASH_URI);
        assertEq(ver, 1);
        assertGt(updatedAt, 0);
        assertEq(proof, bytes32(0));
    }
}
