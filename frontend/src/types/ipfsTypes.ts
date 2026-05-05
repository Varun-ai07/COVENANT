export interface IPFSContent {
  hash: string;
  type: "json" | "image" | "text" | "html" | "unknown";
  data?: any;
  loading: boolean;
  error: string | null;
}
