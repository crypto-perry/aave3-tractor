import type { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { task } from "hardhat/config";
import type { TaskArguments } from "hardhat/types";

import { AaveTractor, AaveTractor__factory } from "../../src/types";

task("deploy:AaveTractor").setAction(async function (taskArguments: TaskArguments, { ethers }) {
  const signers: SignerWithAddress[] = await ethers.getSigners();
  const aaveTractorFactory: AaveTractor__factory = await ethers.getContractFactory("AaveTractor");
  const aaveTractor: AaveTractor = await aaveTractorFactory.connect(signers[0]).deploy();
  await aaveTractor.deployed();
  console.log("Aave Tractor deployed to: ", aaveTractor.address);
});
