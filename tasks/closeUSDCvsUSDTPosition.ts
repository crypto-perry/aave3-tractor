import { ethers } from "hardhat";

import { AaveTractor } from "../src/types";
import { AaveTractorAddress, USDC, USDT } from "../test/constants";
import { numberToTokenAmount, queryOneInch } from "../test/utils";

const closeUSDCvsUSDTPosition = async () => {
  const supply = USDC;
  const borrow = USDT;
  const principal = 3;
  const leverage = 20;
  const slippage = 0.03;

  const aaveTractor: AaveTractor = await ethers.getContractAt("AaveTractor", AaveTractorAddress);

  const repayAmount = principal * leverage * 1.01; // to cover the accrued interest
  const repayAmountBN = numberToTokenAmount(repayAmount, borrow);
  const supplyExchangeAmount = numberToTokenAmount(repayAmount * (1 + slippage), supply);

  const exchangeData = await queryOneInch(supply.address, borrow.address, supplyExchangeAmount);

  const tx = await aaveTractor.closePosition(
    supply.address,
    supplyExchangeAmount,
    borrow.address,
    repayAmountBN,
    exchangeData,
  );

  console.log(await tx.wait());
};

closeUSDCvsUSDTPosition().catch(console.log);
