import { ethers } from "hardhat";

import { AaveTractor } from "../src/types";
import { AaveTractorAddress, USDC, USDT } from "../test/constants";
import { numberToTokenAmount, queryOneInch } from "../test/utils";

const openUSDCvsUSDTPosition = async () => {
  const aaveTractor: AaveTractor = await ethers.getContractAt("AaveTractor", AaveTractorAddress);

  const supply = USDC;
  const borrow = USDT;
  const principal = 3;
  const leverage = 20;
  const slippage = 0.03;

  const principalBN = numberToTokenAmount(principal, supply);
  const supplyAmountBN = numberToTokenAmount(principal + principal * leverage * (1 - slippage), supply);
  const borrowAmountBN = numberToTokenAmount(principal * leverage, borrow);
  const exchangeData = await queryOneInch(borrow.address, supply.address, borrowAmountBN);

  // Only approve first time use
  // const supplySC = (await ethers.getContractAt("IERC20", USDC.address)) as IERC20;
  // await supplySC.approve(aaveTractor.address, ethers.constants.MaxUint256);

  const tx = await aaveTractor.openPosition(
    supply.address,
    principalBN,
    supplyAmountBN,
    borrow.address,
    borrowAmountBN,
    exchangeData,
  );
  console.log(await tx.wait());
};

openUSDCvsUSDTPosition().catch(console.log);
