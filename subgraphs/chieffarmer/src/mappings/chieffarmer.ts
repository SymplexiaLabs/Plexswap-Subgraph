/* eslint-disable @typescript-eslint/no-unused-vars */
import { log } from "@graphprotocol/graph-ts";
import {
  AddPool,
  Deposit,
  EmergencyWithdraw,
  UpdatePoolParams,
  UpdatePoolReward,
  Withdraw,
  UpdateWayaRate,
  UpdateBoostMultiplier,
} from "../../generated/ChiefFarmer/ChiefFarmer";
import { getOrCreateChiefFarmer } from "../entities/chief-farmer";
import { getOrCreatePool } from "../entities/pool";
import { getOrCreateUser, getBoostMultiplier } from "../entities/user";
import { ACC_WAYA_PRECISION, BOOST_PRECISION, BI_ONE, BI_ZERO } from "../utils";

export function handleAddPool(event: AddPool): void {
  log.info("[ChiefFarmer] Add Pool {} {} {} {}", [
    event.params.pid.toString(),
    event.params.allocPoint.toString(),
    event.params.lpToken.toHex(),
    event.params.isRegular ? "true" : "false",
  ]);

  const chiefFarmer = getOrCreateChiefFarmer(event.block);
  const pool = getOrCreatePool(event.params.pid, event.block);

  pool.pair = event.params.lpToken;
  pool.allocPoint = event.params.allocPoint;
  pool.isRegular = event.params.isRegular;
  pool.save();

  if (event.params.isRegular) {
    chiefFarmer.totalRegularAllocPoint = chiefFarmer.totalRegularAllocPoint.plus(pool.allocPoint);
  } else {
    chiefFarmer.totalSpecialAllocPoint = chiefFarmer.totalSpecialAllocPoint.plus(pool.allocPoint);
  }
  chiefFarmer.poolCount = chiefFarmer.poolCount.plus(BI_ONE);
  chiefFarmer.save();
}

export function handleUpdatePoolParams(event: UpdatePoolParams): void {
  log.info("[ChiefFarmer] ˝Update Pool Params {} {}", [
    event.params.pid.toString(),
    event.params.allocPoint.toString(),
  ]);

  const chiefFarmer = getOrCreateChiefFarmer(event.block);
  const pool = getOrCreatePool(event.params.pid, event.block);

  if (pool.isRegular) {
    chiefFarmer.totalRegularAllocPoint = chiefFarmer.totalRegularAllocPoint.plus(
      event.params.allocPoint.minus(pool.allocPoint)
    );
  } else {
    chiefFarmer.totalSpecialAllocPoint = chiefFarmer.totalSpecialAllocPoint.plus(
      event.params.allocPoint.minus(pool.allocPoint)
    );
  }

  chiefFarmer.save();

  pool.allocPoint = event.params.allocPoint;
  pool.save();
}

export function handleUpdatePoolReward(event: UpdatePoolReward): void {
  log.info("[ChiefFarmer] Update Pool Reward {} {} {} {}", [
    event.params.pid.toString(),
    event.params.lastRewardBlock.toString(),
    event.params.lpSupply.toString(),
    event.params.accWayaPerShare.toString(),
  ]);

  const chiefFarmer = getOrCreateChiefFarmer(event.block);
  const pool = getOrCreatePool(event.params.pid, event.block);

  pool.accWayaPerShare = event.params.accWayaPerShare;
  pool.lastRewardBlock = event.params.lastRewardBlock;
  pool.save();
}

export function handleDeposit(event: Deposit): void {
  log.info("[ChiefFarmer] Log Deposit {} {} {}", [
    event.params.user.toHex(),
    event.params.pid.toString(),
    event.params.amount.toString(),
  ]);

  const chiefFarmer = getOrCreateChiefFarmer(event.block);
  const pool = getOrCreatePool(event.params.pid, event.block);
  const user = getOrCreateUser(event.params.user, pool, event.block);

  const multiplier = getBoostMultiplier(user);

  pool.slpBalance = pool.slpBalance.plus(event.params.amount);

  user.amount = user.amount.plus(event.params.amount);
  pool.totalBoostedShare = pool.totalBoostedShare.plus(event.params.amount.times(multiplier).div(BOOST_PRECISION));

  user.rewardDebt = user.amount
    .times(multiplier)
    .div(BOOST_PRECISION)
    .times(pool.accWayaPerShare)
    .div(ACC_WAYA_PRECISION);

  pool.save();
  user.save();
}

export function handleWithdraw(event: Withdraw): void {
  log.info("[ChiefFarmer] Log Withdraw {} {} {}", [
    event.params.user.toHex(),
    event.params.pid.toString(),
    event.params.amount.toString(),
  ]);

  const chiefFarmer = getOrCreateChiefFarmer(event.block);
  const pool = getOrCreatePool(event.params.pid, event.block);
  const user = getOrCreateUser(event.params.user, pool, event.block);

  const multiplier = getBoostMultiplier(user);

  pool.slpBalance = pool.slpBalance.minus(event.params.amount);
  user.amount = user.amount.minus(event.params.amount);

  if (user.amount.equals(BI_ZERO)) {
    pool.userCount = pool.userCount.minus(BI_ONE);
  }

  user.rewardDebt = user.amount
    .times(multiplier)
    .div(BOOST_PRECISION)
    .times(pool.accWayaPerShare)
    .div(ACC_WAYA_PRECISION);

  pool.save();
  user.save();
}

export function handleEmergencyWithdraw(event: EmergencyWithdraw): void {
  log.info("[ChiefFarmer] Log Emergency Withdraw {} {} {}", [
    event.params.user.toHex(),
    event.params.pid.toString(),
    event.params.amount.toString(),
  ]);

  const chiefFarmer = getOrCreateChiefFarmer(event.block);
  const pool = getOrCreatePool(event.params.pid, event.block);
  const user = getOrCreateUser(event.params.user, pool, event.block);

  const multiplier = getBoostMultiplier(user);

  const boostedAmount = event.params.amount.times(multiplier).div(BOOST_PRECISION);

  pool.totalBoostedShare = pool.totalBoostedShare.gt(boostedAmount)
    ? pool.totalBoostedShare.minus(boostedAmount)
    : BI_ZERO;

  user.amount = BI_ZERO;
  user.rewardDebt = BI_ZERO;
  pool.userCount = pool.userCount.minus(BI_ONE);
  user.save();
}

export function handleUpdateWayaRate(event: UpdateWayaRate): void {
  log.info("[ChiefFarmer] Update Waya Rate {} {} {}", [
    event.params.reserveRate.toString(),
    event.params.regularFarmRate.toString(),
    event.params.specialFarmRate.toString(),
  ]);

  const chiefFarmer = getOrCreateChiefFarmer(event.block);

  chiefFarmer.wayaRateToReserve = event.params.reserveRate;
  chiefFarmer.wayaRateToRegularFarm = event.params.regularFarmRate;
  chiefFarmer.wayaRateToSpecialFarm = event.params.specialFarmRate;

  chiefFarmer.save();
}

export function handleUpdateBoostMultiplier(event: UpdateBoostMultiplier): void {
  log.info("[ChiefFarmer] Update Boost Multiplier {} {} {} {}", [
    event.params.user.toString(),
    event.params.pid.toString(),
    event.params.oldMultiplier.toString(),
    event.params.newMultiplier.toString(),
  ]);

  const chiefFarmer = getOrCreateChiefFarmer(event.block);

  const pool = getOrCreatePool(event.params.pid, event.block);
  const user = getOrCreateUser(event.params.user, pool, event.block);

  user.rewardDebt = user.amount
    .times(event.params.newMultiplier)
    .div(BOOST_PRECISION)
    .times(pool.accWayaPerShare)
    .div(ACC_WAYA_PRECISION);

  pool.totalBoostedShare = pool.totalBoostedShare
    .minus(user.amount.times(event.params.oldMultiplier).div(BOOST_PRECISION))
    .plus(user.amount.times(event.params.newMultiplier).div(BOOST_PRECISION));

  user.save();
  pool.save();

  chiefFarmer.save();
}
