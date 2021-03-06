// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.4;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@aave/core-v3/contracts/interfaces/IPool.sol";
import "@aave/core-v3/contracts/interfaces/IPoolAddressesProvider.sol";
import "@aave/core-v3/contracts/interfaces/IPoolDataProvider.sol";
import "@aave/core-v3/contracts/flashloan/interfaces/IFlashLoanReceiver.sol";
import "@aave/periphery-v3/contracts/rewards/interfaces/IRewardsController.sol";

contract AaveTractor is Ownable, IFlashLoanReceiver {
    using SafeERC20 for IERC20;
    using SafeMath for uint256;

    // Aave V3 addresses
    IPool public constant POOL = IPool(0x794a61358D6845594F94dc1DB02A252b5b4814aD);
    IPoolAddressesProvider public constant ADDRESSES_PROVIDER =
        IPoolAddressesProvider(0xa97684ead0e402dC232d5A977953DF7ECBaB3CDb);

    // Aave constants
    uint16 internal constant REFERRAL_CODE = 0;
    uint256 internal constant FLASHLOAN_BORROW_RATE_MODE = 0;
    uint256 internal constant VARIABLE_BORROW_RATE_MODE = 2;
    uint8 internal constant EMODE_CATEGORY_STABLECOINS = 1;

    // 1inch router V4
    address public constant ONE_INCH = 0x1111111254fb6c44bAC0beD2854e76F90643097d;

    // Struct to hold the extra params needed in the flash loan execution for closing or opening a position
    struct FlashLoanData {
        bool openAction;
        address supplyToken;
        // The minimum amount of supply token required (when exchanging from borrow to supply)
        //  or the amount to exhange (from supply to borrow)
        uint256 supplyTokenAmount;
        bytes exchangeData;
    }

    constructor() {
        // Specify that we are operating on stablecoins only to get the 97% collateral factor (up to 33.33x leverage)
        POOL.setUserEMode(EMODE_CATEGORY_STABLECOINS);
    }

    function openPosition(
        address supplyToken,
        uint256 principalAmount,
        uint256 minSupplyAmount,
        address borrowToken,
        uint256 borrowAmount,
        bytes calldata exchangeData
    ) external onlyOwner {
        // Sanity checks
        require(principalAmount > 0, "principal must be positive!");
        require(minSupplyAmount >= principalAmount, "supply amount too small!");
        require(borrowAmount > 0, "borrowAmount must be positive!");

        // Take principal from user
        IERC20(supplyToken).transferFrom(msg.sender, address(this), principalAmount);

        // Request a flash loan for the borrowAmount and repay it by providing collateral
        POOL.flashLoan(
            address(this),
            toArray(borrowToken),
            toArray(borrowAmount),
            toArray(VARIABLE_BORROW_RATE_MODE),
            address(this),
            abi.encode(
                FlashLoanData({
                    openAction: true,
                    supplyToken: supplyToken,
                    supplyTokenAmount: minSupplyAmount - principalAmount,
                    exchangeData: exchangeData
                })
            ),
            REFERRAL_CODE
        );
    }

    function closePosition(
        address supplyToken,
        uint256 supplyExchangeAmount,
        address borrowToken,
        uint256 borrowRepayAmount,
        bytes calldata exchangeData
    ) external onlyOwner {
        // Pay back debt
        if (supplyToken == borrowToken) {
            // If same token, use the new Aave V3 feature repatWithATokens for guaranteed liquidity and lower gas.
            POOL.repayWithATokens(supplyToken, type(uint256).max, VARIABLE_BORROW_RATE_MODE);
        } else {
            // Request a flashloan of borrowRepayAmount and repay it instantly
            POOL.flashLoan(
                address(this),
                toArray(borrowToken),
                toArray(borrowRepayAmount),
                toArray(FLASHLOAN_BORROW_RATE_MODE),
                address(this),
                abi.encode(
                    FlashLoanData({
                        openAction: false,
                        supplyToken: supplyToken,
                        supplyTokenAmount: supplyExchangeAmount,
                        exchangeData: exchangeData
                    })
                ),
                REFERRAL_CODE
            );
        }

        // Send remaining collateral and rewards to user
        POOL.withdraw(supplyToken, type(uint256).max, msg.sender);
    }

    function executeOperation(
        address[] calldata assets, // assets[0] is the flash loan / borrow token
        uint256[] calldata amounts, // amounts[0] is the flash loan amount
        uint256[] calldata premiums, // premium[0] is the fee on the flash loan
        address, /*initiator*/
        bytes calldata callbackData
    ) external override returns (bool) {
        require(msg.sender == address(POOL), "only Aave V3 can call!");

        FlashLoanData memory flash = abi.decode(callbackData, (FlashLoanData));

        if (flash.openAction) {
            uint256 supplyTokenBalance = IERC20(flash.supplyToken).balanceOf(address(this));
            // If different tokens, swap supply yo borrow to cover the flash lk
            if (flash.supplyToken != assets[0]) {
                supplyTokenBalance = supplyTokenBalance.add(
                    swap(assets[0], amounts[0], flash.supplyToken, flash.supplyTokenAmount, flash.exchangeData)
                );
            }
            // Provide collateral to cover the flash loan
            supply(flash.supplyToken, supplyTokenBalance);
        } else {
            // Repay the debt
            IERC20(assets[0]).safeIncreaseAllowance(address(POOL), amounts[0]);
            POOL.repay(assets[0], amounts[0], VARIABLE_BORROW_RATE_MODE, address(this));

            // Redeem all the collateral supplied
            POOL.withdraw(flash.supplyToken, flash.supplyTokenAmount, address(this));

            // Exchange the collateral to flash loaned token s.t. it covers the flash loan
            uint256 flashRepayAmount = amounts[0] + premiums[0];
            swap(flash.supplyToken, flash.supplyTokenAmount, assets[0], flashRepayAmount, flash.exchangeData);

            // Allow POOL to pull flash loan repayment
            IERC20(assets[0]).safeIncreaseAllowance(address(POOL), flashRepayAmount);

            uint256 borrowTokenBalance = IERC20(assets[0]).balanceOf(address(this));
            // Send leftovers to owner (Due to slippage and interest accrual margins,
            // there will always be some leftover amounts.)
            IERC20(assets[0]).safeTransfer(owner(), borrowTokenBalance - flashRepayAmount);
        }

        return true;
    }

    function toArray(uint256 value) internal pure returns (uint256[] memory array) {
        array = new uint256[](1);
        array[0] = value;
    }

    function toArray(address value) internal pure returns (address[] memory array) {
        array = new address[](1);
        array[0] = value;
    }

    function swap(
        address fromToken,
        uint256 inputAmount,
        address toToken,
        uint256 minOutputAmount,
        bytes memory exchangeData
    ) internal returns (uint256 outputAmount) {
        IERC20(fromToken).safeIncreaseAllowance(ONE_INCH, inputAmount);

        uint256 prevBalance = IERC20(toToken).balanceOf(address(this));

        (bool success, bytes memory returndata) = ONE_INCH.call(exchangeData);
        if (!success) {
            if (returndata.length > 0) {
                assembly {
                    let returndata_size := mload(returndata)
                    revert(add(32, returndata), returndata_size)
                }
            } else {
                revert("1inch tx failed without reason");
            }
        }
        outputAmount = IERC20(toToken).balanceOf(address(this)).sub(prevBalance);
        require(outputAmount >= minOutputAmount, "slippage exceeded!");
    }

    function supply(address token, uint256 amount) internal {
        IERC20(token).safeIncreaseAllowance(address(POOL), amount);
        POOL.supply(token, amount, address(this), REFERRAL_CODE);
    }

    function rescueTokens(address token, uint256 amount) external onlyOwner {
        IERC20(token).transfer(msg.sender, amount);
    }
}
