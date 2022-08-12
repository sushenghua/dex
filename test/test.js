const { expect } = require("chai");
const { ethers, waffle } = require("hardhat");

/*
 * --- metamask recovery phrase ---
 * rigid index virtual vital whisper wave heavy cave fetch brass soap soldier
*/

const toB32Str = (ticker) => ethers.utils.formatBytes32String(ticker);
const toBE = (num) => ethers.utils.parseUnits(num.toString(), unit = "ether")
const fromBE = (num) => ethers.utils.formatUnits(num.toString(), unit = "ether")
const toBG = (num) => ethers.utils.parseUnits(num.toString(), unit = "gwei")
const fromBG = (num) => ethers.utils.formatUnits(num.toString(), unit = "gwei")

describe('Dex', function () {
  // --- contract names
  const dexContractName = 'Dex';
  const tokenContractNames = ['Blue', 'Cyan', 'Pink', 'Red', 'Usdt'];
  const ETH = toB32Str('ETH');
  // --- contract parameters
  const SIDE = { BUY: 0, SELL: 1 };
  // --- contracts
  let dex;
  let tokens = {};
  // --- accounts
  let admin;
  let traders = [];
  // --- initial balances
  const initialETHBalance = toBE("50000.0")
  // --- provider
  const provider = waffle.provider;

  before(async () => {
    accounts = await ethers.getSigners();
    admin = accounts[0];
    for (i = 1; i <= 6; i++) {
      traders.push(accounts[i]);
    }
  });

  const deployContract = async (contractName, depositEthers = false, ...args) => {
    const Contract = await ethers.getContractFactory(contractName);
    contract = await Contract.deploy();
    await contract.deployed();
    if (depositEthers) {
      await admin.sendTransaction({
        from: admin.address,
        to: contract.address,
        // value: ethers.utils.parseEther("10.0")
        value: toBE("10000.0")
      })
    }
    return contract;
  };

  const deployAllTokenContracts = async () => {
    let contracts = {};
    for (i = 0; i < tokenContractNames.length; i++) {
      const contractName = tokenContractNames[i];
      contracts[contractName] = await deployContract(contractName);
      const symbol = await contracts[contractName].symbol();
      contracts[contractName].t = toB32Str(symbol);
    }
    return contracts;
  }

  const approveTokens = async (tokens, owner, spender) => {
    for (key in tokens) {
      token = tokens[key];
      amount = toBE(10000.0);
      await token.faucet(owner.address, amount);
      await token.connect(owner).approve(spender.address, amount);
    }
  }

  const faucetETHToTraders = async (traders) => {
    for (i = 0; i < traders.length; i++) {
      await admin.sendTransaction({
        from: admin.address,
        to: traders[i].address,
        value: initialETHBalance
      })
    }
  }

  const addAllTokens = async () => {
    for (key in tokens) {
      token = tokens[key];
      const symbol = await token.symbol();
      await dex.addToken(toB32Str(symbol), token.address);
    }
  }

  const easyDeposit = async (trader, ticker, amount) => {
    await dex.connect(trader).deposit(
      toB32Str(ticker),
      toBE(amount.toString()));
  }

  const easyLimitOrder = async (trader, baseTicker, quoteTicker, amount, price, side) => {
    await dex.connect(trader).createLimitOrder(
      toB32Str(baseTicker),
      toB32Str(quoteTicker),
      toBE(amount.toString()),
      toBG(price),
      side
    );
  }

  const easyMarketOrder = async (trader, baseTicker, quoteTicker, amount, side) => {
    await dex.connect(trader).createMarketOrder(
      toB32Str(baseTicker),
      toB32Str(quoteTicker),
      toBE(amount.toString()),
      side
    );
  }

  beforeEach(async () => {
    dex = await deployContract(dexContractName, depositEthers = true);
    tokens = await deployAllTokenContracts();
    await approveTokens(tokens, traders[0], dex);
    await approveTokens(tokens, traders[1], dex);
    await approveTokens(tokens, traders[2], dex);
  });

  it("admin identity", async () => {
    expect(await dex.admin()).to.equal(admin.address);
  });

  it('add tokens', async () => {
    await addAllTokens(dex, tokens);
    const tickersHex = await dex.getTickers();
    const tickers = tickersHex.map(ticker => ethers.utils.parseBytes32String(ticker));
    expect(tickers.length).to.eql(Object.keys(tokens).length);
    expect(tickers.toString()).to.eql(tokenContractNames.toString().toUpperCase());
  });

  it('approve quote token', async () => {
    await addAllTokens(dex, tokens);
    // const ETH = toB32Str('ETH');
    await dex.approveQuoteToken(ETH);
    expect(await dex.quoteTickers(ETH)).to.be.true;
    await dex.approveQuoteToken(tokens.Usdt.t);
    expect(await dex.quoteTickers(tokens.Usdt.t)).to.be.true;
    const GRAY = toB32Str('GRAY');
    await expect(
      dex.approveQuoteToken(GRAY)
    ).to.be.revertedWith('token not found in the dex');
  });

  it('deposit tokens to dex', async () => {
    await addAllTokens(dex, tokens);
    await dex.connect(traders[0]).deposit(tokens.Blue.t, toBE(100.0));
    const blueBalance = await dex.totalBalances(traders[0].address, tokens.Blue.t);
    expect(blueBalance).to.eql(toBE(100.0));
  });

  it('deposit ETH to dex', async () => {
    await addAllTokens(dex, tokens);
    // await faucetETHToTraders(traders);
    const amount = toBE("100.0");
    await traders[0].sendTransaction({
      from: traders[0].address,
      to: dex.address,
      value: amount
    });
    const ethBalance = await dex.totalBalances(traders[0].address, ETH);
    expect(ethBalance).to.eql(amount);

    // deposit ETH only by transfering ETH directly to dex
    const amount1 = toBE("150.0");
    await expect(
      dex.connect(traders[0]).deposit(ETH, amount1)
    ).to.be.revertedWith('deposit ETH by transfering ether directly to the dex contract');
  });

  it('should not deposit tokens if token does not exist in the dex', async () => {
    await addAllTokens(dex, tokens);
    const amount = toBE('100.0');
    const GRAY = toB32Str('GRAY');
    await expect(
      dex.connect(traders[0]).deposit(GRAY, amount)
    ).to.be.revertedWith('token not found in the dex');
  });

  it('withdraw tokens from dex', async () => {
    await addAllTokens(dex, tokens);
    const amount = toBE("10000.0");
    token = tokens.Blue;
    ticker = token.t;
    await dex.connect(traders[0]).deposit(ticker, amount);
    await dex.connect(traders[0]).withdraw(ticker, amount);
    const [tickerBalanceDex, tickerBalanceTrader] = await Promise.all([
      dex.totalBalances(traders[0].address, ticker),
      token.balanceOf(traders[0].address)
    ])
    expect(tickerBalanceDex.toNumber()).to.eql(0);
    expect(tickerBalanceTrader).to.eql(amount);
  });

  it('withdraw ETH from dex', async () => {
    await addAllTokens(dex, tokens);
    // await faucetETHToTraders(traders);
    const amount = toBE("200.0");
    await traders[0].sendTransaction({
      from: traders[0].address,
      to: dex.address,
      value: amount
    });
    const withdrawAmount = toBE("100.0");
    await dex.connect(traders[0]).withdraw(ETH, withdrawAmount);
    const ethBalance = await dex.totalBalances(traders[0].address, ETH);
    expect(ethBalance).to.eql(toBE("100.0"));
    const ethBalanceTrader = await provider.getBalance(traders[0].address);
    etherLeft = parseFloat(ethers.utils.formatEther(ethBalanceTrader))
    expect(etherLeft).to.be.lte(99999900.0);
  });

  it('should not withdraw tokens if token does not exist', async () => {
    await addAllTokens(dex, tokens);
    const amount = toBE('100.0');
    const GRAY = toB32Str('GRAY');
    await expect(
      dex.connect(traders[0]).withdraw(GRAY, amount)
    ).to.be.revertedWith('token not found in the dex');
  });

  it('should not withdraw tokens if insufficient balance ', async () => {
    await addAllTokens(dex, tokens);
    const amount = toBE("10000.0");
    const morethanamount = toBE("10001.0");
    token = tokens.Blue;
    ticker = token.t;
    await dex.connect(traders[0]).deposit(ticker, amount);
    await expect(
      dex.connect(traders[0]).withdraw(ticker, morethanamount)
    ).to.be.revertedWith('insufficient available balance');
  });

  it('create limit order', async () => {
    await addAllTokens(dex, tokens);
    baseToken = tokens.Blue;
    baseTicker = baseToken.t;
    quoteToken = tokens.Usdt;
    quoteTicker = quoteToken.t;
    await dex.approveQuoteToken(quoteTicker);

    // trades[0] buy
    const orderPrice = toBG(10);
    const baseAmount = toBE("100.0");
    const quoteAmount = toBE("200.0");
    const orderAmount = toBE("5.0");
    await dex.connect(traders[0]).deposit(baseTicker, baseAmount);
    await dex.connect(traders[0]).deposit(quoteTicker, quoteAmount);
    await dex.connect(traders[0]).createLimitOrder(
      baseTicker, quoteTicker, orderAmount, orderPrice, SIDE.BUY
    );
    let buyOrders = await dex.getOrderBook(baseTicker, quoteTicker, SIDE.BUY);
    let sellOrders = await dex.getOrderBook(baseTicker, quoteTicker, SIDE.SELL);
    expect(buyOrders.length).to.eql(1);
    expect(buyOrders[0].trader).to.eql(traders[0].address);
    expect(buyOrders[0].ticker).to.eql(baseTicker);
    expect(buyOrders[0].price.toNumber()).to.eql(orderPrice.toNumber());
    expect(buyOrders[0].amount).to.eql(orderAmount);
    expect(sellOrders.length).to.eql(0);

    // trades[1] buy
    const orderPrice1 = toBG(11);
    const baseAmount1 = toBE("100.0");
    const quoteAmount1 = toBE("200.0");
    const orderAmount1 = toBE("3.0");
    await dex.connect(traders[1]).deposit(baseTicker, baseAmount1);
    await dex.connect(traders[1]).deposit(quoteTicker, quoteAmount1);
    await dex.connect(traders[1]).createLimitOrder(
      baseTicker, quoteTicker, orderAmount1, orderPrice1, SIDE.BUY
    );
    buyOrders = await dex.getOrderBook(baseTicker, quoteTicker, SIDE.BUY);
    sellOrders = await dex.getOrderBook(baseTicker, quoteTicker, SIDE.SELL);
    expect(buyOrders.length).to.eql(2);
    expect(buyOrders[1].trader).to.eql(traders[1].address); // buy highest price tail
    expect(buyOrders[0].trader).to.eql(traders[0].address);
    expect(buyOrders[1].ticker).to.eql(baseTicker);
    expect(buyOrders[1].price.toNumber()).to.eql(orderPrice1.toNumber());
    expect(buyOrders[1].amount).to.eql(orderAmount1);
    expect(sellOrders.length).to.eql(0);

    // trades[2] buy
    const orderPrice2 = toBG(9);
    const baseAmount2 = toBE("700.0");
    const quoteAmount2 = toBE("800.0");
    const orderAmount2 = toBE("15.0");
    await dex.connect(traders[2]).deposit(baseTicker, baseAmount2);
    await dex.connect(traders[2]).deposit(quoteTicker, quoteAmount2);
    await dex.connect(traders[2]).createLimitOrder(
      baseTicker, quoteTicker, orderAmount2, orderPrice2, SIDE.BUY
    );
    buyOrders = await dex.getOrderBook(baseTicker, quoteTicker, SIDE.BUY);
    sellOrders = await dex.getOrderBook(baseTicker, quoteTicker, SIDE.SELL);
    expect(buyOrders.length).to.eql(3);
    expect(buyOrders[2].trader).to.eql(traders[1].address);
    expect(buyOrders[1].trader).to.eql(traders[0].address);
    expect(buyOrders[0].trader).to.eql(traders[2].address);
    expect(buyOrders[0].ticker).to.eql(baseTicker);
    expect(buyOrders[0].price.toNumber()).to.eql(orderPrice2.toNumber());
    expect(buyOrders[0].amount).to.eql(orderAmount2);
    expect(sellOrders.length).to.eql(0);
  });

  it('should not create limit order if token does not exist', async () => {
    await addAllTokens(dex, tokens);
    const GRAY = toB32Str('GRAY');
    const baseTicker = GRAY;
    const quoteToken = tokens.Usdt;
    const quoteTicker = quoteToken.t;
    await dex.approveQuoteToken(quoteTicker);
    const orderPrice = toBG(10);
    const orderAmount = toBE("5.0");
    await expect(
      dex.connect(traders[0]).createLimitOrder(
        baseTicker, quoteTicker, orderAmount, orderPrice, SIDE.BUY
      )
    ).to.be.revertedWith('token not found in the dex');
  });

  it('should not create limit order if base token is same as quote token', async () => {
    await addAllTokens(dex, tokens);
    const baseTicker = tokens.Usdt.t;
    const quoteTicker = baseTicker;
    await dex.approveQuoteToken(quoteTicker);
    const orderPrice = toBG(10);
    const baseAmount = toBE("100.0");
    const quoteAmount = toBE("200.0");
    const orderAmount = toBE("5.0");
    await dex.connect(traders[0]).deposit(baseTicker, baseAmount);
    await dex.connect(traders[0]).deposit(quoteTicker, quoteAmount);
    await expect(
      dex.connect(traders[0]).createLimitOrder(
        baseTicker, quoteTicker, orderAmount, orderPrice, SIDE.BUY
      )
    ).to.be.revertedWith('base and quote tickers must be different');
  });

  it('should not create limit order if insufficient base/quote token balance', async () => {
    await addAllTokens(dex, tokens);
    const baseTicker = tokens.Blue.t;
    const quoteTicker = tokens.Usdt.t;
    await dex.approveQuoteToken(quoteTicker);
    const baseAmount = toBE("100.0");
    const quoteAmount = toBE("200.0");
    const buyAmount = toBE("25.0");
    const sellAmount = toBE("101.0");
    const orderPrice = toBG(10);
    await dex.connect(traders[0]).deposit(baseTicker, baseAmount);
    await dex.connect(traders[0]).deposit(quoteTicker, quoteAmount);
    await expect(
      dex.connect(traders[0]).createLimitOrder(
        baseTicker, quoteTicker, sellAmount, orderPrice, SIDE.SELL
      )
    ).to.be.revertedWith('insufficient available base token balance');
    await expect(
      dex.connect(traders[0]).createLimitOrder(
        baseTicker, quoteTicker, buyAmount, orderPrice, SIDE.BUY
      )
    ).to.be.revertedWith('insufficient available quote token balance');
  });

  it('create market order', async () => {
    await addAllTokens(dex, tokens);
    await dex.approveQuoteToken(toB32Str('USDT'));

    await easyDeposit(traders[0], 'USDT', '1000');
    await easyLimitOrder(traders[0], 'BLUE', 'USDT', 100, 10, SIDE.BUY);

    await easyDeposit(traders[1], 'BLUE', '100');
    await easyMarketOrder(traders[1], 'BLUE', 'USDT', 5, SIDE.SELL);

    let buyOrders = await dex.getOrderBook(toB32Str('BLUE'), toB32Str('USDT'), SIDE.BUY);
    let sellOrders = await dex.getOrderBook(toB32Str('BLUE'), toB32Str('USDT'), SIDE.SELL);
    expect(buyOrders.length).to.eql(1);
    expect(sellOrders.length).to.eql(0);
    expect(buyOrders[0].filled).to.eql(toBE(5));

    let balances = await Promise.all([
      dex.totalBalances(traders[0].address, toB32Str('USDT')),
      dex.totalBalances(traders[0].address, toB32Str('BLUE')),
      dex.totalBalances(traders[1].address, toB32Str('USDT')),
      dex.totalBalances(traders[1].address, toB32Str('BLUE')),
    ])
    expect(balances).to.eql([
      toBE('950'),
      toBE('5'),
      toBE('50'),
      toBE('95')
    ]);

    await easyDeposit(traders[2], 'BLUE', '100');
    await easyMarketOrder(traders[2], 'BLUE', 'USDT', 100, SIDE.SELL);
    buyOrders = await dex.getOrderBook(toB32Str('BLUE'), toB32Str('USDT'), SIDE.BUY);
    sellOrders = await dex.getOrderBook(toB32Str('BLUE'), toB32Str('USDT'), SIDE.SELL);
    expect(buyOrders.length).to.eql(0);
    expect(sellOrders.length).to.eql(0);

    balances = await Promise.all([
      dex.totalBalances(traders[0].address, toB32Str('USDT')),
      dex.totalBalances(traders[0].address, toB32Str('BLUE')),
      dex.totalBalances(traders[2].address, toB32Str('USDT')),
      dex.totalBalances(traders[2].address, toB32Str('BLUE')),
    ])
    expect(balances).to.eql([
      toBE('0'),
      toBE('100'),
      toBE('950'),
      toBE('5')
    ]);
  });
});
