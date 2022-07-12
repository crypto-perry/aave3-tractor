import { ethers } from "hardhat";

import { AaveTractor } from "../src/types";
import { AaveTractorAddress, USDC } from "../test/constants";
import { numberToTokenAmount } from "../test/utils";

const openUSDCvsUSDCPosition = async () => {
  const aaveTractor: AaveTractor = await ethers.getContractAt("AaveTractor", AaveTractorAddress);

  const supply = USDC;
  const borrow = USDC;
  const principal = 3;
  const leverage = 20;

  const principalBN = numberToTokenAmount(principal, supply);
  const supplyAmountBN = numberToTokenAmount(principal + principal * leverage, supply);
  const borrowAmountBN = numberToTokenAmount(principal * leverage, borrow);
  const exchangeData = "0x";

  // const supplySC = (await ethers.getContractAt("IERC20", USDC.address)) as IERC20;

  // await supplySC.approve(aaveTractor.address, ethers.constants.MaxUint256);

  await aaveTractor.openPosition(
    supply.address,
    principalBN,
    supplyAmountBN,
    borrow.address,
    borrowAmountBN,
    exchangeData,
  );
};

openUSDCvsUSDCPosition().catch(console.log);
