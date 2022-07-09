import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { formatUnits } from "ethers/lib/utils";
import { artifacts, ethers, waffle } from "hardhat";

import { AaveTractor, IERC20 } from "../../src/types";
import { DAI, USDC, USDT } from "../constants";
import { fund, numberToTokenAmount, queryOneInch } from "../utils";

describe("Unit Tests Aave Tractor", function () {
  let signer: SignerWithAddress;
  let aaveTractor: AaveTractor;

  before(async function () {
    signer = (await ethers.getSigners())[0];

    await fund(signer.address, USDC, 100_000);
    await fund(signer.address, USDT, 100_000);
    await fund(signer.address, DAI, 100_000);
  });

  const TABLE = [
    {
      principal: 100,
      leverage: 7,
      supply: USDC,
      borrow: USDC,
      exchangeData: "0x",
      slippage: 0.001,
    },
    {
      principal: 10_000,
      leverage: 7,
      supply: USDC,
      borrow: USDT,
      slippage: 0.03,
    },
    // {
    //   principal: 100,
    //   leverage: 7,
    //   supply: USDC,
    //   borrow: DAI,
    //   slippage: 0.01,
    // },
  ];

  for (const { principal, supply, borrow, leverage, slippage } of TABLE) {
    describe(`type: ${supply.symbol} vs. ${borrow.symbol}; principal: ${principal} ${supply.symbol}; leverage: ${leverage}x`, function () {
      let supplySC: IERC20, borrowSC: IERC20;

      before(async function () {
        supplySC = (await ethers.getContractAt("IERC20", supply.address)) as IERC20;
        borrowSC = (await ethers.getContractAt("IERC20", borrow.address)) as IERC20;
        aaveTractor = (await waffle.deployContract(signer, await artifacts.readArtifact("AaveTractor"))) as AaveTractor;
      });

      it(`open`, async function () {
        await supplySC.approve(aaveTractor.address, ethers.constants.MaxUint256);

        const principalBN = numberToTokenAmount(principal, supply);
        const supplyAmountBN = numberToTokenAmount(principal + principal * leverage * (1 - slippage), supply);
        const borrowAmountBN = numberToTokenAmount(principal * leverage, borrow);
        const exchangeDataOnOpen =
          supply.address == borrow.address ? "0x" : await queryOneInch(borrow.address, supply.address, borrowAmountBN);

        await expect(
          aaveTractor.openPosition(
            supply.address,
            principalBN,
            supplyAmountBN,
            borrow.address,
            borrowAmountBN,
            exchangeDataOnOpen,
          ),
        ).to.not.be.reverted;
      });

      it(`close`, async function () {
        const repayAmount = principal * leverage * 1.01; // to cover the accrued interest
        const repayAmountBN = numberToTokenAmount(repayAmount, borrow);
        const supplyExchangeAmount = numberToTokenAmount(repayAmount * (1 + slippage), supply);

        const exchangeDataOnClose =
          supply.address == borrow.address
            ? "0x"
            : await queryOneInch(supply.address, borrow.address, supplyExchangeAmount);

        await expect(
          aaveTractor.closePosition(
            supply.address,
            supplyExchangeAmount,
            borrow.address,
            repayAmountBN,
            exchangeDataOnClose,
          ),
        ).to.not.be.reverted;

        console.log("Supply token balance:", formatUnits(await supplySC.balanceOf(signer.address), supply.decimals));
        console.log("Borrow token balance:", formatUnits(await borrowSC.balanceOf(signer.address), borrow.decimals));
      });
    });
  }
});
