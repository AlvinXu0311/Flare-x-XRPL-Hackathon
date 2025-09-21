 const { ethers } = require('ethers')

  async function main() {
    const provider = new ethers.providers.JsonRpcProvider('https://rpc-coston2.flare.network')
    const wallet = new ethers.Wallet('OWNER_PRIVATE_KEY', provider)

    const contract = new ethers.Contract(
      '0x6cd4FEb053E613dF60CF10f0DD1D9597051D241B',
      ['function setPediatricPsychologist(bytes32,address)'],
      wallet
    )

    await contract.setPediatricPsychologist(
      "0xfef81ff8312c24f710f7e918aefa26ef",
      "0xd976ece7f97402cc704731e8d64e747d1126161565a1208473a9bf64bffc8570"
    )

    console.log('Done!')
  }

  main()