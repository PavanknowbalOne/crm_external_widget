const pad = (num) => String(num).padStart(2, "0");

const toIsoDateString = (value) =>
  `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;

export const formatCurrency = (value) => {
  const amount = Number(value);
  if (Number.isNaN(amount)) {
    return "-";
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(amount);
};

export const getStatusVariant = (status) => {
  if (!status) return "secondary";  // If no status is provided, return "secondary"

  const normalized = status.toLowerCase();  // Normalize the status to lowercase for case-insensitive comparison
  
  // Exact match checks for specific status values
  if (normalized === "paid") return "success";  // "paid" maps to "success" (green color)
  if (normalized === "partial paid") return "warning";  // "partial paid" maps to "warning" (yellow color)
  
  // Contains checks for other status values
  if (normalized.includes("pending")) return "secondary";  // "pending" maps to "secondary" (grey color)
  if (normalized.includes("overdue")) return "danger";  // "overdue" maps to "danger" (red color)
  
  // Default case if no matches are found
  return "info";  // Default to "info" (blue color)
};


export const formatDateForZoho = (value) => {
  if (!value) return "";
  if (value instanceof Date) {
    return `${pad(value.getDate())}-${pad(value.getMonth() + 1)}-${
      value.getFullYear()
    }`;
  }
  if (typeof value === "string") {
    const isoMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (isoMatch) {
      const [, year, month, day] = isoMatch;
      return `${day}-${month}-${year}`;
    }
    const slashMatch = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (slashMatch) {
      const [, month, day, year] = slashMatch;
      return `${day}-${month}-${year}`;
    }
    const dashMatch = value.match(/^(\d{2})-(\d{2})-(\d{4})$/);
    if (dashMatch) {
      return value;
    }
  }
  const parsed = new Date(value);
  if (!Number.isNaN(parsed)) {
    return `${pad(parsed.getDate())}-${pad(parsed.getMonth() + 1)}-${
      parsed.getFullYear()
    }`;
  }
  return value;
};

export const formatDateForInput = (value) => {
  if (!value) return "";
  if (value instanceof Date) {
    return toIsoDateString(value);
  }
  if (typeof value === "string") {
    const isoMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (isoMatch) {
      const [, year, month, day] = isoMatch;
      return `${year}-${month}-${day}`;
    }
    const dashMatch = value.match(/^(\d{2})-(\d{2})-(\d{4})$/);
    if (dashMatch) {
      const [, day, month, year] = dashMatch;
      return `${year}-${month}-${day}`;
    }
    const slashMatch = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (slashMatch) {
      const [, month, day, year] = slashMatch;
      return `${year}-${month}-${day}`;
    }
  }
  const parsed = new Date(value);
  if (!Number.isNaN(parsed)) {
    return toIsoDateString(parsed);
  }
  return "";
};

export const getInitialCreateFormData = () => ({
  Request_Date: toIsoDateString(new Date()),
  Payment_Status: "Pending",
  Requested_Amount: "",
  Received_Amount: 0,
  Request_Note: "",
  Payment_Request_ID: "",
  Payee_Location: "Australia",
  Agent: null,
  Agent_ID: "",
});

export const normalizeRecordId = (value) => {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  return String(value);
};

export const normalizeDisplayValue = (value) => {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  return String(value).trim().toLowerCase();
};

export const sumReceiptAmounts = (receipts = []) => {
  if (!receipts.length) {
    return 0;
  }
  return receipts.reduce((sum, receipt) => {
    const amountCandidate =
      receipt?.Received_Amount ??
      receipt?.Amount ??
      receipt?.Payment_Amount ??
      receipt?.Amount_Received ??
      receipt?.Amount_Paid ??
      0;
    const amount = Number(amountCandidate);
    return Number.isFinite(amount) ? sum + amount : sum;
  }, 0);
};

export const getReceiptMeta = (receipt = {}) => {
  const receiptDate =
    receipt.Received_Date ||
    "—";
  const receiptAmount =
    receipt.Amount_Received ??
    0;
  const receiptMode =
    receipt.Payment_Mode ||
    "—";
  const unUtilizedAmount =
    receipt.Un_Utilised_Amount ||
    "—";  
  const receiptNote =
    receipt.Note ||
    "—";
  const receiptNumber =
    receipt.Receive_ID ||
    "—";
   const receiptReconcilation = 
     receipt.Reconciliation1 

  return {
    receiptDate,
    receiptAmount,
    receiptMode,
    unUtilizedAmount,
    receiptNote,
    receiptReconcilation,
    receiptNumber,
  };
};
