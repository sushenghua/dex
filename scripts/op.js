// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
const { ethers, waffle, network } = require("hardhat");
const dexjson = require('../frontend/src/contracts/Dex.json')
const erc20json = require('../frontend/src/contracts/ERC20Abi.json')
const tokenAddresses = require('../frontend/src/contracts/tokens.json')
const { NonceManager } = require("@ethersproject/experimental");

const toB32Str = (ticker) => ethers.utils.formatBytes32String(ticker);
const fromB32Str = (bytes32str) => ethers.utils.parseBytes32String(bytes32str)
const toBE = (num) => ethers.utils.parseUnits(num.toString(), unit = "ether")
const fromBE = (num) => ethers.utils.formatUnits(num.toString(), unit = "ether")
const toBG = (num) => ethers.utils.parseUnits(num.toString(), unit = "gwei")
const fromBG = (num) => ethers.utils.formatUnits(num.toString(), unit = "gwei")
const delay = ms => new Promise(res => setTimeout(res, ms));

const remoteDelay = async (seconds, tag = '', silent = true) => {
  if (network.name === 'goerli') {
    if (!silent) console.log(`\n${tag}delay ${seconds}s to avoid exceeding remote API call limit`);
    await delay(seconds * 1000);
  }
}

const getSigners = async () => {
  let traders = [];
  const signers = await ethers.getSigners();
  let admin = signers[0];
  const traderCount = signers.length > 6 ? 6 : signers.length - 1;
  for (i = 1; i <= traderCount; i++) {
    traders.push(signers[i]);
  }
  return [admin, traders];
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

const getSigner = (account) => {
  const provider = new ethers.providers.EtherscanProvider('goerli', '9ZVqoBmLCGrU0rYVnlIXzheGcZ-lt0I_')
  if (account) {
    return account.connect(provider)
  }
  else {
    const address = "0x8ba1f109551bD432803012645Ac136ddd64DBA72"
    return new ethers.VoidSigner(address, provider)
  }
}

const getDexContract = (signer) => {
  // const contract = new ethers.Contract('0x7ad0bc921940796b60B4DEA950316A4731799d7f', dexjson.abi, signer)
  const contract = new ethers.Contract(dexjson.address, dexjson.abi, signer)
  return contract
}

const getTokenContracts = (signer) => {
  let contractDict = {}
  let contractArray = []
  for (const symbol in tokenAddresses) {
    const address = tokenAddresses[symbol]
    const contract = new ethers.Contract(address, erc20json.abi, signer)
    contract.s = symbol
    contract.address = address
    contractDict[symbol] = contract
    contractArray.push(contract)
  }
  return [contractDict, contractArray]
}

const getNonce = async (provider, address) => {
  const nonce = await provider.getTransactionCount(address)
  return nonce + 1
}

const addTokens = async (dex, tokens) => {
  for (const token of tokens) {
    // await Promise.all(tokens.map(async (token) => {
    try {
      const tx = await dex.addToken(toB32Str(token.s), token.address, { gasLimit: 3000000 });
      await tx.wait();
      // await remoteDelay(1, `addToken(${token.symbol}) `,);
    } catch (e) {
      console.log(`addToken(${token.s}) err`, e);
    }
    // }));
  }
};

// const approveTraderTokens = async (tokens, trader, dex, easyAmount) => {
//   for (const token of tokens) {
//     // await Promise.all(tokens.map(async (token) => {
//     const amount = toBE(easyAmount);
//     try {
//       const adminNonce = await getNonce(dex.provider, dex.signer.address)
//       const faucetTx = await token.faucet(trader.address, amount.mul(3), { nonce: adminNonce });
//       // const faucetTx = await token.faucet(trader.address, amount.mul(3))
//       await faucetTx.wait();
//       await remoteDelay(1);
//       const traderNonce = await getNonce(trader.provider, trader.address)
//       const approveTx = await token.connect(trader).approve(dex.address, amount, { nonce: traderNonce });
//       // const approveTx = await token.connect(trader).approve(dex.address, amount);
//       await approveTx.wait()
//       await remoteDelay(1);
//       const depositTx = await dex.connect(trader).deposit(token.t, amount, { nonce: traderNonce + 1 });
//       // const depositTx = await dex.connect(trader).deposit(toB32Str(token.symbol), amount);
//       await depositTx.wait()
//       await remoteDelay(1);
//     } catch (e) {
//       console.log(`approveTraderTokens(${token.s}) err`, e);
//     }
//     // }));
//   }
// };

const approveTraderTokens = async (tokens, trader, dex, amount) => {
  console.log(`\nfaucet and deposit tokens to ${trader.address}`)
  for (const token of tokens) {
    const _amount = toBE(amount);
    try {
      console.log(`faucet ${token.s} ...`)
      // const faucetTx = await token.faucet(trader.address, _amount.mul(3))
      // await faucetTx.wait();
      // await remoteDelay(1);

      console.log(`approve ${amount} ${token.s} for dex ...`)
      const approveTx = await token.connect(trader).approve(dex.address, _amount);
      await approveTx.wait()
      await remoteDelay(1, '', true);

      console.log(`deposit ${amount} ${token.s} to dex ...`)
      const depositTx = await dex.connect(trader).deposit(toB32Str(token.s), _amount);
      await depositTx.wait()
      await remoteDelay(1);
    } catch (e) {
      console.log(`[approveTraderTokens(${token.s}) err]:`, e);
    }
  }
};

async function main() {
  // --- accounts
  const [admin, traders] = await getSigners();

  // --- contracts
  const dex = getDexContract(admin);
  // console.log('dex address:', dex.address);
  const [dict, tokens] = getTokenContracts(admin);

  // await remoteDelay(60)

  // --- dex operation simulation
  console.log("dex operation simulation");

  // --- tokens to dex
  // await addTokens(dex, tokens);

  // --- withdraw unused tokens
  // await dex.connect(admin).withdraw(toB32Str('ETH'), toBE(0.1));

  // --- mint tokens to traders, then deposit to dex
  for (const trader of traders) {
    await approveTraderTokens(tokens, trader, dex, 100e4);
  }
}


// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
