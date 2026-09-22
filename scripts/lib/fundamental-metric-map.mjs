export const FUNDAMENTAL_METRICS = Object.freeze({
  revenue: { periodType: "duration", concepts: [
    ["us-gaap","RevenueFromContractWithCustomerExcludingAssessedTax"],
    ["us-gaap","RevenueFromContractWithCustomerIncludingAssessedTax"],
    ["us-gaap","Revenues"],
    ["us-gaap","SalesRevenueNet"],
    ["ifrs-full","Revenue"],
    ["ifrs-full","RevenueFromContractsWithCustomers"]
  ]},
  gross_profit: { periodType: "duration", concepts: [
    ["us-gaap","GrossProfit"],["ifrs-full","GrossProfit"]
  ]},
  operating_income: { periodType: "duration", concepts: [
    ["us-gaap","OperatingIncomeLoss"],["ifrs-full","ProfitLossFromOperatingActivities"]
  ]},
  net_income: { periodType: "duration", concepts: [
    ["us-gaap","NetIncomeLoss"],["ifrs-full","ProfitLoss"]
  ]},
  operating_cash_flow: { periodType: "duration", concepts: [
    ["us-gaap","NetCashProvidedByUsedInOperatingActivities"],
    ["ifrs-full","CashFlowsFromUsedInOperatingActivities"]
  ]},
  capital_expenditures: { periodType: "duration", concepts: [
    ["us-gaap","PaymentsToAcquirePropertyPlantAndEquipment"],
    ["us-gaap","PaymentsForAdditionsToPropertyPlantAndEquipment"],
    ["ifrs-full","PurchaseOfPropertyPlantAndEquipment"]
  ]},
  cash_and_equivalents: { periodType: "instant", concepts: [
    ["us-gaap","CashAndCashEquivalentsAtCarryingValue"],["ifrs-full","CashAndCashEquivalents"]
  ]},
  long_term_debt_current: { periodType: "instant", concepts: [
    ["us-gaap","LongTermDebtCurrent"]
  ]},
  long_term_debt_noncurrent: { periodType: "instant", concepts: [
    ["us-gaap","LongTermDebtNoncurrent"]
  ]},
  borrowings_current_ifrs: { periodType: "instant", concepts: [
    ["ifrs-full","CurrentBorrowings"]
  ]},
  borrowings_noncurrent_ifrs: { periodType: "instant", concepts: [
    ["ifrs-full","NoncurrentBorrowings"]
  ]},
  shares_outstanding: { periodType: "instant", concepts: [
    ["dei","EntityCommonStockSharesOutstanding"],
    ["us-gaap","CommonStockSharesOutstanding"],
    ["ifrs-full","NumberOfSharesOutstanding"]
  ]}
});
