// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
const { ethers, waffle, network } = require("hardhat");

const toB32Str = (ticker) => ethers.utils.formatBytes32String(ticker);
const toBE = (num) => ethers.utils.parseUnits(num.toString(), unit = "ether")
const fromBE = (num) => ethers.utils.formatUnits(num.toString(), unit = "ether")
const toBG = (num) => ethers.utils.parseUnits(num.toString(), unit = "gwei")
const fromBG = (num) => ethers.utils.formatUnits(num.toString(), unit = "gwei")
const delay = ms => new Promise(res => setTimeout(res, ms));

const remoteDelay = async (seconds, tag = '', silent = false) => {
  if (network.name === 'goerli') {
    if (!silent) console.log(`\n${tag}delay ${seconds}s to avoid exceeding remote API call limit`);
    await delay(seconds * 1000);
  }
}

const getAccounts = async () => {
  let traders = [];
  accounts = await ethers.getSigners();
  let admin = accounts[0];
  const traderCount = accounts.length > 6 ? 6 : accounts.length - 1;
  for (i = 1; i <= traderCount; i++) {
    traders.push(accounts[i]);
  }
  return [admin, traders];
};

const deployContract = async (contractName, depositEthers = 0, admin) => {
  const Contract = await ethers.getContractFactory(contractName);
  const contract = await Contract.deploy();
  await contract.deployed();
  if (depositEthers > 0) {
    await admin.sendTransaction({
      from: admin.address,
      to: contract.address,
      // value: ethers.utils.parseEther("10.0")
      value: toBE(depositEthers),
    });
  }
  return contract;
};

const deployAllTokenContracts = async (tokenContractNames) => {
  let contracts = {};
  let tickers = []
  for (i = 0; i < tokenContractNames.length; i++) {
    const contractName = tokenContractNames[i];

    let contract = null;
    let symbol = null;
    try {
      contract = await deployContract(contractName);
      symbol = await contract.symbol();
    } catch (e) {
      console.log(e);
      if (contract == null) console.log("contract deploy failed");
      if (symbol == null) console.log("symbol fetch failed");
    }

    if (contract) contracts[contractName] = contract;
    if (symbol) {
      contracts[contractName].s = symbol;
      contracts[contractName].t = toB32Str(symbol);
      tickers.push(contracts[contractName].s);
    }
  }
  return [contracts, tickers];
};

const addTokens = async (dex, tokens) => {
  await Promise.all(tokens.map(async (token) => {
    await remoteDelay(5, `addToken(${token.s}) `,);
    try {
      const symbol = await token.symbol();
      await dex.addToken(toB32Str(symbol), token.address);
    } catch (e) {
      console.log(`addToken(${token}) err`, e);
    }
  }));
};

const approveTraderTokens = async (tokens, trader, dex, easyAmount) => {
  await Promise.all(tokens.map(async (token) => {
    const amount = toBE(easyAmount);
    try {
      await token.faucet(trader.address, amount.mul(3));
      await remoteDelay(5, (silent = true));
      const tx = await token.connect(trader).approve(dex.address, amount);
      await tx.wait()
      await remoteDelay(5, (silent = true));
      await dex.connect(trader).deposit(token.t, amount);
      await remoteDelay(5, (silent = true));
    } catch (e) {
      console.log(`approveTraderTokens(${token.s}) err`, e);
    }
  }));
};

const faucetETHToTraders = async (admin, traders, easyAmount) => {
  await Promise.all(traders.map(async (trader) => {
    await admin.sendTransaction({
      from: admin.address,
      to: trader.address,
      value: toBE(easyAmount),
    });
  }));
};

const easyDeposit = async (dex, trader, ticker, easyAmount) => {
  await dex.connect(trader).deposit(toB32Str(ticker), toBE(easyAmount));
};

const easyLimitOrder = async (dex, trader, baseTicker, quoteTicker, easyAmount, price, side) => {
  await dex
    .connect(trader)
    .createLimitOrder(
      toB32Str(baseTicker),
      toB32Str(quoteTicker),
      toBE(easyAmount),
      toBG(price),
      side
    );
};

const easyMarketOrder = async (dex, trader, baseTicker, quoteTicker, easyAmount, side) => {
  await dex
    .connect(trader)
    .createMarketOrder(
      toB32Str(baseTicker),
      toB32Str(quoteTicker),
      toBE(easyAmount),
      side
    );
};

const increaseTime = async (seconds) => {
  const time = await ethers.provider.getBlock("latest");
  const newTime = time.timestamp + seconds;
  await ethers.provider.send("evm_increaseTime", [seconds]);
  // await ethers.provider.send("evm_increaseTime", [newTime]);
  // await ethers.provider.send("evm_setNextBlockTimestamp", [newTime])
  await ethers.provider.send("evm_mine");
};

const waitChain = async (seconds) => {
  if (network.name === 'localhost' || network.name === 'hardhat') {
    await increaseTime(seconds);
  } else {
    await remoteDelay(seconds, (silent = true));
  }
}

const createOrders = async (dex, traders, tickers) => {
  const [BLUE, CYAN, PINK, RED, USDT] = tickers;
  const ETH = "ETH";
  // const SIDE = { BUY: 0, SELL: 1 };
  const [BUY, SELL] = [0, 1];

  await dex.approveQuoteToken(toB32Str(USDT));
  await dex.approveQuoteToken(toB32Str(ETH));

  await easyLimitOrder(dex, traders[1], BLUE, USDT, 1000, 10, BUY);
  await waitChain(1);
  await easyMarketOrder(dex, traders[2], BLUE, USDT, 1000, SELL);
  await waitChain(1);
  await easyLimitOrder(dex, traders[1], BLUE, USDT, 1200, 11, BUY);
  await waitChain(1);
  await easyMarketOrder(dex, traders[2], BLUE, USDT, 1200, SELL);
  await waitChain(1);
  await easyLimitOrder(dex, traders[1], BLUE, USDT, 1200, 15, BUY);
  await waitChain(1);
  await easyMarketOrder(dex, traders[2], BLUE, USDT, 1200, SELL);
  await waitChain(1);
  await easyLimitOrder(dex, traders[1], BLUE, USDT, 1500, 14, BUY);
  await waitChain(1);
  await easyMarketOrder(dex, traders[2], BLUE, USDT, 1500, SELL);
  await waitChain(1);
  await easyLimitOrder(dex, traders[1], BLUE, USDT, 2000, 12, BUY);
  await waitChain(1);
  await easyMarketOrder(dex, traders[2], BLUE, USDT, 2000, SELL);

  await easyLimitOrder(dex, traders[1], CYAN, USDT, 1000, 2, BUY);
  await waitChain(1);
  await easyMarketOrder(dex, traders[2], CYAN, USDT, 1000, SELL);
  await waitChain(1);
  await easyLimitOrder(dex, traders[1], CYAN, USDT, 500, 4, BUY);
  await waitChain(1);
  await easyMarketOrder(dex, traders[2], CYAN, USDT, 500, SELL);
  await waitChain(1);
  await easyLimitOrder(dex, traders[1], CYAN, USDT, 800, 2, BUY);
  await waitChain(1);
  await easyMarketOrder(dex, traders[2], CYAN, USDT, 800, SELL);
  await waitChain(1);

  await Promise.all([
    easyLimitOrder(dex, traders[1], BLUE, USDT, 1400, 10, BUY),
    easyLimitOrder(dex, traders[2], BLUE, USDT, 1200, 11, BUY),
    easyLimitOrder(dex, traders[2], BLUE, USDT, 1000, 12, BUY),

    easyLimitOrder(dex, traders[1], CYAN, USDT, 3000, 4, BUY),
    easyLimitOrder(dex, traders[1], CYAN, USDT, 2000, 5, BUY),
    easyLimitOrder(dex, traders[2], CYAN, USDT, 1000, 6, BUY),

    easyLimitOrder(dex, traders[1], PINK, USDT, 5000, 12, BUY),
    easyLimitOrder(dex, traders[1], PINK, USDT, 3000, 13, BUY),
    easyLimitOrder(dex, traders[2], PINK, USDT, 1000, 14, BUY),

    easyLimitOrder(dex, traders[3], BLUE, USDT, 1000, 15, SELL),
    easyLimitOrder(dex, traders[4], BLUE, USDT, 1500, 14, SELL),
    easyLimitOrder(dex, traders[4], BLUE, USDT, 2000, 13, SELL),

    easyLimitOrder(dex, traders[3], CYAN, USDT, 4000, 8, SELL),
    easyLimitOrder(dex, traders[3], CYAN, USDT, 3000, 7, SELL),
    easyLimitOrder(dex, traders[4], CYAN, USDT, 2000, 7, SELL),

    easyLimitOrder(dex, traders[3], PINK, USDT, 2000, 22, SELL),
    easyLimitOrder(dex, traders[3], PINK, USDT, 1500, 21, SELL),
    easyLimitOrder(dex, traders[4], PINK, USDT, 1000, 20, SELL),
  ]);
};

async function main() {
  let depositEthersToDex = 0
  if (network.name === "hardhat") {
    console.warn(
      "contract to the Hardhat Network (automatically created and destroyed every time)."
      // + "\nUse the Hardhat option '--network localhost'"
    );
  }
  else if (network.name === "localhost") {
    depositEthersToDex = 500e4
  }
  else if (network.name === "goerli") {
    depositEthersToDex = 0.001
  }

  // --- contract names
  const tokenContractNames = ["Blue", "Cyan", "Pink", "Red", "Usdt"];

  // --- provider
  // const provider = waffle.provider;

  // --- accounts
  const [admin, traders] = await getAccounts();

  // --- dex contracts
  const dex = await deployContract("Dex", (depositEthers = depositEthersToDex), admin);
  // --- save frontend files
  saveContractToFrontendFiles(dex, "Dex");

  // --- token contracts
  const [tokenDict, tickers] = await deployAllTokenContracts(tokenContractNames);
  const tokens = Object.values(tokenDict);
  saveJsonToFrontendFile(
    tokens.reduce((acc, token) => ({
      ...acc,
      [token.s]: token.address,
    }), {}),
    "tokens"
  )

  // --- logs
  console.log("\ncontract deployed to:", dex.address);
  console.log("\ntokens deployed to:");
  tokens.map(token => console.log(token.s.padEnd(4, ' '), token.address));

  await remoteDelay(60)

  // --- dex operation simulation
  console.log("\ndex operation simulation");
  await addTokens(dex, tokens);
  await Promise.all(traders.map(async trader => await approveTraderTokens(tokens, trader, dex, 100e4)));
  // await faucetETHToTraders(admin, traders, 1000e9);
  try {
    await createOrders(dex, traders, tickers);
  } catch (e) {
    console.log(`createOrders err`, e);
  }
}

function saveJsonToFrontendFile(json, name) {
  const fs = require("fs");

  // --- save token addresses
  const dir = __dirname + "/../frontend/src/contracts";
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir)
  }
  fs.writeFileSync(dir + '/' + name + '.json', JSON.stringify(json, null, 2));

  // --- save copy according to network name
  const cpdir = dir + "/" + network.name;
  if (!fs.existsSync(cpdir)) {
    fs.mkdirSync(cpdir)
  }
  fs.writeFileSync(
    cpdir + "/" + name + ".json",
    JSON.stringify(json, null, 2)
  )
}

function saveContractToFrontendFiles(contract, contractName) {
  const fs = require("fs");

  // --- copy contract abi file
  const contractsDir = __dirname + "/../frontend/src/contracts";
  if (!fs.existsSync(contractsDir)) {
    fs.mkdirSync(contractsDir)
  }

  // fs.writeFileSync(
  //   contractsDir + "/contract-address.json",
  //   JSON.stringify({ Contract: contract.address }, undefined, 2)
  // );
  let contractArtifact = artifacts.readArtifactSync(contractName);
  contractArtifact.address = contract.address;
  fs.writeFileSync(
    contractsDir + "/" + contractName + ".json",
    JSON.stringify(contractArtifact, null, 2)
  )

  // --- save copy according to network name
  const cpdir = contractsDir + "/" + network.name;
  if (!fs.existsSync(cpdir)) {
    fs.mkdirSync(cpdir)
  }
  fs.writeFileSync(
    cpdir + "/" + contractName + ".json",
    JSON.stringify(contractArtifact, null, 2)
  )
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
