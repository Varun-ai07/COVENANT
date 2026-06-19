// Core
export { ReceiptEngine } from "./receipt-engine.js";
export type { ReceiptEnvelope, CoordinatorConfig } from "./receipt-engine.js";

// Coordinator (unified service)
export { CovenantCoordinator } from "./coordinator.js";

// Services
export { ReputationOracle } from "./reputation-oracle.js";
export { CapabilityManager } from "./capability-manager.js";
export { InsuranceService } from "./services/insurance.service.js";
export { CollectiveService } from "./services/collective.service.js";
export { OpenTaskMarket } from "./services/task-market.service.js";

// Persistence
export { loadStore, saveStore } from "./persistence.js";

// Types
export type * from "./types.js";
