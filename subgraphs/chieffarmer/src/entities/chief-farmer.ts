import { BigInt, dataSource, ethereum } from "@graphprotocol/graph-ts";
import { ChiefFarmer } from "../../generated/schema";
import { BI_ZERO } from "../utils";

export function getOrCreateChiefFarmer(block: ethereum.Block): ChiefFarmer {
  let chiefFarmer = ChiefFarmer.load(dataSource.address().toHex());

  if (chiefFarmer === null) {
    chiefFarmer = new ChiefFarmer(dataSource.address().toHex());
    chiefFarmer.totalRegularAllocPoint = BI_ZERO;
    chiefFarmer.totalSpecialAllocPoint = BI_ZERO;
    chiefFarmer.wayaRateToBurn = BigInt.fromString("750000000000");
    chiefFarmer.wayaRateToRegularFarm = BigInt.fromString("100000000000");
    chiefFarmer.wayaRateToSpecialFarm = BigInt.fromString("150000000000");
    chiefFarmer.poolCount = BI_ZERO;
  }

  chiefFarmer.timestamp = block.timestamp;
  chiefFarmer.block = block.number;
  chiefFarmer.save();

  return chiefFarmer as ChiefFarmer;
}
