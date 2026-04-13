/**
 * Safe transaction submission with gas estimation and balance checks
 * Prevents failed transactions that waste gas
 */

import { parseEther } from "viem";

export interface SafeSendOptions {
  value?: bigint;
  gasLimit?: bigint;
  maxPriorityFeePerGas?: bigint;
  maxFeePerGas?: bigint;
}

/**
 * Estimate gas for a transaction and check balance before sending
 * @throws Will throw if transaction would fail or balance insufficient
 */
export async function safeSubmit(
  publicClient: any,
  wallet: any,
  txRequest: SafeSendOptions & { to: string; data?: string; from?: string }
): Promise<any> {
  // Estimate gas with the wallet's address as the sender
  let gasEstimate: bigint;
  try {
    gasEstimate = await publicClient.estimateGas({
      ...txRequest,
      account: wallet.address, // Set the from address for accurate estimation
    });
  } catch (error: any) {
    throw new Error(`Gas estimation failed: ${error.message}. Transaction would revert.`);
  }

  // Add 20% buffer for safety
  const gasWithBuffer = gasEstimate * 120n / 100n;

  // Get balance
  const balance = await publicClient.getBalance({ address: wallet.address });

  // Get fee data
  const feeData = await publicClient.getFeeData();
  const maxPriorityFeePerGas = txRequest.maxPriorityFeePerGas || feeData.maxPriorityFeePerGas || 0n;
  const maxFeePerGas = txRequest.maxFeePerGas || feeData.maxFeePerGas || 0n;

  // Calculate max cost: gas * maxFeePerGas + value
  const maxGasCost = gasWithBuffer * maxFeePerGas;
  const totalCost = maxGasCost + (txRequest.value || 0n);

  if (balance < totalCost) {
    throw new Error(
      `Insufficient balance: have ${parseEther(balance.toString()).toString()} ETH, ` +
      `need ${parseEther(totalCost.toString()).toString()} ETH (gas + value)`
    );
  }

  // Send transaction with estimated gas
  const hash = await wallet.sendTransaction({
    ...txRequest,
    gas: gasWithBuffer,
  });

  return hash;
}

/**
 * Safe multicall - execute multiple calls in one transaction using the router
 */
export async function safeMulticall(
  publicClient: any,
  wallet: any,
  routerAddress: string,
  routerAbi: any,
  calls: Array<{ target: string; value: bigint; data: string }>
): Promise<any> {
  const totalValue = calls.reduce((sum, call) => sum + call.value, 0n);

  const gasEstimate = await publicClient.estimateContractInteraction({
    address: routerAddress,
    abi: routerAbi,
    functionName: "multicall",
    args: [calls],
    value: totalValue,
  });

  const gasWithBuffer = gasEstimate * 120n / 100n;
  const balance = await publicClient.getBalance({ address: wallet.address });
  const feeData = await publicClient.getFeeData();
  const maxFee = (gasWithBuffer * (feeData.maxFeePerGas || 0n)) + totalValue;

  if (balance < maxFee) {
    throw new Error(`Insufficient balance for multicall: have ${balance}, need ${maxFee}`);
  }

  const hash = await wallet.writeContract({
    address: routerAddress,
    abi: routerAbi,
    functionName: "multicall",
    args: [calls],
    value: totalValue,
    gas: gasWithBuffer,
  });

  return hash;
}
