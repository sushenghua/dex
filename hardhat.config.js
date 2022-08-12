require("@nomiclabs/hardhat-waffle");

// This is a sample Hardhat task. To learn how to create your own go to
// https://hardhat.org/guides/create-task.html
task("accounts", "Prints the list of accounts", async (taskArgs, hre) => {
  const accounts = await hre.ethers.getSigners();

  for (const account of accounts) {
    console.log(account.address);
  }
});

// You need to export an object to set up your config
// Go to https://hardhat.org/config/ to learn more

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = {
  solidity: "0.8.4",
  networks: {
    goerli: {
      url: "https://eth-goerli.g.alchemy.com/v2/9ZVqoBmLCGrU0rYVnlIXzheGcZ-lt0I_",
      accounts: [
        "257b118ac958138937a5e08f610133dd6487162fff9c9d39a9107dddf549745e", // account 1
        "29353d542762a35d714711a0a58aadd55542287d17ad5f2dd89df4caa86f5a6d", // account 2
        "239fc65b7eb64de2163897b7d56d56dba31d5a5fac3725ffe756095fcbc16027", // account 3
        "9878e2822cc3229a6fbd9fd512966caf54b95392cceaab45d5df63606cb8ceaf", // account 4
      ]
    },
    hardhat: {
      accounts: {
        accountsBalance: "100000000000000000000000000", // 100,000,000 ether
      }
    },
    localhost: {
      url: "http://localhost:8545",
      chainId: 31337,
      // gasPrice: 50e8
      gas: 30e6,
      blockGasLimit: 1e17
      // allowUnlimitedContractSize: true
    },

    // rinkeby: {
    //   url: "https://eth-rinkeby.alchemyapi.io/v2/123abc123abc123abc123abc123abcde",
    //   accounts: [privateKey1, privateKey2, ...]
    // }
  },
};
