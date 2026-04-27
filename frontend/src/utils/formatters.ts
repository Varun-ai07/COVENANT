// Shared utility functions for the COVENANT frontend
export function formatAddress(address: string, chars = 4): string {
  if (!address) return "";
  if (address.length <= chars * 2 + 2) return address;
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`;
}

// Format ETH values
export function formatEth(value: bigint, decimals = 4): string {
  const eth = Number(value) / 1e18;
  return eth.toFixed(decimals);
}

// Format USD values
export function formatUSD(value: number, decimals = 2): string {
  return value ? `$${value.toFixed(decimals)}` : '$0.00';
}

// Format dates
export function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

// Format time differences
export function formatTimeDiff(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffMinutes = Math.floor(diffMs / (1000 * 60));

  if (diffDays > 0) {
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  } else if (diffHours > 0) {
    return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  } else {
    return `${diffMinutes} minute${diffMinutes > 1 ? 's' : ''} ago`;
  }
}

// Truncate text
export function truncateText(text: string, length = 100): string {
  if (text.length <= length) return text;
  return text.substring(0, length) + '...';
}

// Format reputation level
export function getReputationLevel(reputation: number): {
  label: string;
  color: string;
  bgColor: string;
} {
  if (reputation >= 800) return { label: "Excellent", color: "text-emerald-400", bgColor: "bg-emerald-500" };
  if (reputation >= 600) return { label: "Good", color: "text-green-400", bgColor: "bg-green-500" };
  if (reputation >= 400) return { label: "Average", color: "text-amber-400", bgColor: "bg-amber-500" };
  if (reputation >= 200) return { label: "Poor", color: "text-orange-400", bgColor: "bg-orange-500" };
  return { label: "Critical", color: "text-red-400", bgColor: "bg-red-500" };
}