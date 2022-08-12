//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "hardhat/console.sol";

contract Dex {
    // -------------------------------------------------------------------------
    // ------------ data type
    struct Token {
        bytes32 ticker;
        address tokenAddress;
    }

    enum Side {
        BUY,
        SELL
    }

    struct Order {
        uint256 id;
        Side side;
        address trader;
        bytes32 ticker;
        uint256 amount;
        uint256 filled;
        uint256 price;
        uint256 date;
    }

    // -------------------------------------------------------------------------
    // ------------ state variables
    address public admin;
    mapping(bytes32 => Token) public tokens;
    bytes32[] public tickers;
    mapping(bytes32 => bool) public quoteTickers;
    mapping(address => mapping(bytes32 => uint256)) public totalBalances;
    mapping(address => mapping(bytes32 => uint256)) public inOrderAmount;
    // mapping(bytes32 => mapping(uint8 => Order[])) public orderBook;
    mapping(bytes32 => mapping(bytes32 => mapping(uint8 => Order[])))
        public orderBook;
    uint256 public nextOrderId; // > 0,  0 is reserved for no order created
    uint256 public nextTradeId;
    uint256 constant PDIV = 1000000000;
    bytes32 constant ETH = bytes32("ETH");

    // -------------------------------------------------------------------------
    // ------------ events
    // event NewOrder(
    //     uint256 orderId,
    //     uint8 side,
    //     bytes32 indexed baseTicker,
    //     bytes32 quoteTicker,
    //     address indexed trader,
    //     uint256 amount,
    //     uint256 price,
    //     uint256 date
    // );
    event NewTrade(
        uint256 tradeId,
        uint256 orderId,
        bytes32 indexed baseTicker,
        bytes32 indexed quoteTicker,
        uint8 side,
        address buyer,
        address seller,
        uint256 amount,
        uint256 price,
        uint256 indexed date
    );

    // -------------------------------------------------------------------------
    // ------------ view methods
    function getTickers() public view returns (bytes32[] memory) {
        return tickers;
    }

    function getOrderBook(
        bytes32 baseTicker,
        bytes32 quoteTicker,
        uint8 side
    ) public view returns (Order[] memory) {
        return orderBook[quoteTicker][baseTicker][side];
    }

    function getTokens() public view returns (Token[] memory) {
        Token[] memory result = new Token[](tickers.length);
        for (uint256 i = 0; i < tickers.length; i++) {
            result[i] = tokens[tickers[i]];
        }
        return result;
    }

    function getQuotes() public view returns (bytes32[] memory) {
        bytes32[] memory result = new bytes32[](tickers.length + 1); // +1 for ETH
        uint256 j = 0;
        for (uint256 i = 0; i < tickers.length; i++) {
            if (quoteTickers[tickers[i]]) {
                result[j++] = (tickers[i]);
            }
        }
        if (quoteTickers[ETH]) {
            result[j++] = ETH;
        }
        return result;
    }

    // -------------------------------------------------------------------------
    // ------------ constructor, modifiers
    constructor() {
        admin = msg.sender;
        // console.log("deploy contract by admin '%s'", admin);
    }

    modifier onlyAdmin() {
        require(msg.sender == admin, "only admin can call this function");
        _;
    }

    modifier tokenExists(bytes32 ticker) {
        require(
            ticker == ETH || tokens[ticker].tokenAddress != address(0),
            "token not found in the dex"
        );
        _;
    }

    modifier quoteTokenListed(bytes32 ticker) {
        require(quoteTickers[ticker], "quote token not listed in the dex");
        _;
    }

    modifier positiveAmount(uint256 amount) {
        require(amount > 0, "amount value must be positive");
        _;
    }

    function addToken(bytes32 ticker, address tokenAddress) external onlyAdmin {
        require(
            tokens[ticker].tokenAddress == address(0),
            "token with the same name already added to the dex"
        );
        tokens[ticker] = Token(ticker, tokenAddress);
        tickers.push(ticker);
        // ====== debug code ======
        // string memory t = string(abi.encodePacked(ticker));
        // console.log("add token %s, address %s", t, tokenAddress);
        // =========================
    }

    // -------------------------------------------------------------------------
    // ------------ application functionality
    function approveQuoteToken(bytes32 ticker) external onlyAdmin {
        require(
            quoteTickers[ticker] == false,
            "quote token already approved in the dex"
        );
        if (ticker != ETH) {
            require(
                tokens[ticker].tokenAddress != address(0),
                "token not found in the dex"
            );
        }
        quoteTickers[ticker] = true;
    }

    receive() external payable {
        totalBalances[msg.sender][ETH] += msg.value;
    }

    function deposit(bytes32 ticker, uint256 amount)
        external
        tokenExists(ticker)
        positiveAmount(amount)
    {
        require(
            ticker != ETH,
            "deposit ETH by transfering ether directly to the dex contract"
        );
        IERC20(tokens[ticker].tokenAddress).transferFrom(
            msg.sender,
            address(this),
            amount
        );
        totalBalances[msg.sender][ticker] += amount;
    }

    function withdraw(bytes32 ticker, uint256 amount)
        external
        tokenExists(ticker)
        positiveAmount(amount)
    {
        require(
            totalBalances[msg.sender][ticker] -
                inOrderAmount[msg.sender][ticker] >=
                amount,
            "insufficient available balance"
        );
        totalBalances[msg.sender][ticker] -= amount;
        if (ticker != ETH) {
            IERC20(tokens[ticker].tokenAddress).transfer(msg.sender, amount);
        } else {
            payable(msg.sender).transfer(amount);
        }
    }

    function genTrade(
        Order memory order,
        bytes32 baseTicker,
        bytes32 quoteTicker,
        Side side,
        uint256 amount
    ) private {
        emit NewTrade(
            nextTradeId,
            order.id,
            baseTicker,
            quoteTicker,
            uint8(side),
            side == Side.BUY ? msg.sender : order.trader,
            side == Side.BUY ? order.trader : msg.sender,
            amount,
            order.price,
            block.timestamp
        );
        nextTradeId++;
        uint256 amountChg = (amount * order.price) / PDIV;
        if (side == Side.SELL) {
            totalBalances[msg.sender][baseTicker] -= amount;
            totalBalances[msg.sender][quoteTicker] += amountChg;
            totalBalances[order.trader][baseTicker] += amount;
            totalBalances[order.trader][quoteTicker] -= amountChg;
            // order trader as buyer
            inOrderAmount[order.trader][quoteTicker] -= amountChg;
        } else {
            totalBalances[msg.sender][baseTicker] += amount;
            totalBalances[msg.sender][quoteTicker] -= amountChg;
            totalBalances[order.trader][baseTicker] -= amount;
            totalBalances[order.trader][quoteTicker] += amountChg;
            // order trader as seller
            inOrderAmount[order.trader][baseTicker] -= amount;
        }
    }

    function createLimitOrder(
        bytes32 baseTicker,
        bytes32 quoteTicker,
        uint256 amount,
        uint256 price,
        Side side
    )
        external
        tokenExists(baseTicker)
        quoteTokenListed(quoteTicker)
        positiveAmount(amount)
        returns (uint256)
    {
        require(
            baseTicker != quoteTicker,
            "base and quote tickers must be different"
        );
        require(price > 0, "price must be positive");
        if (side == Side.BUY) {
            require(
                totalBalances[msg.sender][quoteTicker] -
                    inOrderAmount[msg.sender][quoteTicker] >=
                    (price * amount) / PDIV,
                "insufficient available quote token balance"
            );
        } else {
            require(
                totalBalances[msg.sender][baseTicker] -
                    inOrderAmount[msg.sender][baseTicker] >=
                    amount,
                "insufficient available base token balance"
            );
        }

        // check opposite order book to find matches
        Order[] storage opstOrders = orderBook[quoteTicker][baseTicker][
            uint8(side == Side.BUY ? Side.SELL : Side.BUY)
        ];
        uint256 i = opstOrders.length;
        uint256 remaining = amount;
        while (i > 0 && remaining > 0) {
            i--;
            if (
                (side == Side.BUY && price >= opstOrders[i].price) ||
                (side == Side.SELL && price <= opstOrders[i].price)
            ) {
                uint256 available = opstOrders[i].amount - opstOrders[i].filled;
                uint256 matched = available > remaining ? remaining : available;
                remaining -= matched;
                opstOrders[i].filled += matched;
                genTrade(opstOrders[i], baseTicker, quoteTicker, side, matched);
                // remove filled order from the order book
                if (opstOrders[i].filled == opstOrders[i].amount) {
                    opstOrders.pop();
                }
            } else break;
        }
        // check if already fullfilled
        if (remaining > 0) {
            Order[] storage orders = orderBook[quoteTicker][baseTicker][
                uint8(side)
            ];
            nextOrderId++;
            orders.push(
                Order(
                    nextOrderId,
                    side,
                    msg.sender,
                    baseTicker,
                    amount,
                    amount - remaining,
                    price,
                    block.timestamp
                )
            );
            if (side == Side.BUY) {
                inOrderAmount[msg.sender][quoteTicker] +=
                    (price * remaining) /
                    PDIV;
            } else {
                inOrderAmount[msg.sender][baseTicker] += remaining;
            }
            // sort orders by price: BUY order highest price, SELL order lowest price
            //   to save operations: BUY highest tail,        SELL lowest tail
            // compare: same price, ealier order has higher priority
            i = orders.length - 1;
            while (i > 0) {
                if (side == Side.BUY && orders[i - 1].price < orders[i].price) {
                    break;
                }
                if (
                    side == Side.SELL && orders[i - 1].price > orders[i].price
                ) {
                    break;
                }
                Order memory tmp = orders[i - 1];
                orders[i - 1] = orders[i];
                orders[i] = tmp;
                i--;
            }
            return nextOrderId;
        }
        return 0;
    }

    function createMarketOrder(
        bytes32 baseTicker,
        bytes32 quoteTicker,
        uint256 amount,
        Side side
    ) external tokenExists(baseTicker) quoteTokenListed(quoteTicker) {
        require(
            baseTicker != quoteTicker,
            "base and quote tickers must be different"
        );
        require(amount > 0, "amount value must be positive");
        if (side == Side.SELL) {
            require(
                totalBalances[msg.sender][baseTicker] -
                    inOrderAmount[msg.sender][baseTicker] >=
                    amount,
                "insufficient available base token balance"
            );
        }

        // ref to the orders of opposite side
        Order[] storage orders = orderBook[quoteTicker][baseTicker][
            uint8(side == Side.BUY ? Side.SELL : Side.BUY)
        ];
        require(orders.length > 0, "lack of liquidity as no order matched");

        // loop through all orders and fill them
        uint256 i = orders.length;
        uint256 remaining = amount;
        while (i > 0 && remaining > 0) {
            i--;
            uint256 available = orders[i].amount - orders[i].filled;
            uint256 matched = available > remaining ? remaining : available;
            remaining -= matched;
            orders[i].filled += matched;
            if (side == Side.BUY) {
                require(
                    totalBalances[msg.sender][quoteTicker] -
                        inOrderAmount[msg.sender][quoteTicker] >=
                        (matched * orders[i].price) / PDIV,
                    "insufficient available quote token balance"
                );
            }
            genTrade(orders[i], baseTicker, quoteTicker, side, matched);
        }

        // remove filled orders
        i = orders.length;
        do {
            i--;
            if (orders[i].filled == orders[i].amount) {
                orders.pop();
            }
        } while (i > 0);
    }

    function cancelOrder(
        uint256 orderId,
        bytes32 baseTicker,
        bytes32 quoteTicker,
        Side side
    ) external tokenExists(baseTicker) quoteTokenListed(quoteTicker) {
        require(orderId > 0, "invalid order id");
        require(
            baseTicker != quoteTicker,
            "base and quote tickers must be different"
        );
        Order[] storage orders = orderBook[quoteTicker][baseTicker][
            uint8(side)
        ];
        uint256 i = 0;
        bool found = false;
        while (i < orders.length) {
            if (found) {
                orders[i - 1] = orders[i];
            } else if (orders[i].id == orderId) {
                found = true;
                if (side == Side.BUY) {
                    inOrderAmount[msg.sender][quoteTicker] -=
                        (orders[i].price *
                            (orders[i].amount - orders[i].filled)) /
                        PDIV;
                } else {
                    inOrderAmount[msg.sender][baseTicker] -= (orders[i].amount -
                        orders[i].filled);
                }
            }
            ++i;
        }
        require(found, "order not found");
        orders.pop();
    }
}
