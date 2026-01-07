import React, {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import InvoiceCreateModal from "./components/InvoiceCreateModal";
import InvoiceHeader from "./components/InvoiceHeader";
import InvoiceListCard from "./components/InvoiceListCard";
import PaymentUtilizationModal from "./components/PaymentUtilizationModal";
import {
  formatDateForInput,
  formatDateForZoho,
} from "../Accounts/utils/recordUtils";
const PaymentRequestEmailModal = React.lazy(() =>
  import("../Accounts/components/PaymentRequestEmailModal")
);

const normalizeRecordId = (value) => {
  if (value === undefined || value === null || value === "") {
    return "";
  }
  return String(value).trim();
};

const buildBillingAddressPayload = (source = {}) => {
  const nestedAddress = source.Billing_Address || {};
  const line1 =
    source.Billing_Address_Line_1 ||
    nestedAddress.address_line_1 ||
    "";
  const line2 =
    source.Billing_Address_Line_2 ||
    nestedAddress.address_line_2 ||
    "";
  const city =
    source.City ||
    nestedAddress.district_city ||
    nestedAddress.city ||
    "";
  const state =
    source.State ||
    nestedAddress.state_province ||
    nestedAddress.state ||
    "";
  const postalCode =
    source.Postal_Code ||
    nestedAddress.postal_code ||
    "";
  const country =
    source.Country ||
    nestedAddress.country ||
    "";
  const hasValue = [line1, line2, city, state, postalCode, country].some(
    (value) => Boolean(value)
  );
  if (!hasValue) {
    return undefined;
  }
  return {
    address_line_1: line1 || "",
    address_line_2: line2 || "",
    district_city: city || "",
    state_province: state || "",
    postal_code: postalCode || "",
    country: country || "",
  };
};

const getAppLinkName = () => {
  const scriptAppName =
    document.querySelector("script[data-app-name]")?.dataset?.appName;
  const urlParams = new URLSearchParams(window.location.search);
  const paramAppName = urlParams.get("appLinkName");
  const pathMatch = window.location.pathname.match(/app\/([^/]+)/i);
  return (
    scriptAppName ||
    paramAppName ||
    pathMatch?.[1] ||
    window.ZOHO?.CREATOR?.config?.appLinkName ||
    window.__APP_LINK_NAME__ ||
    ""
  );
};

const getZohoResponseErrorMessage = (response) => {
  if (!response) {
    return "";
  }
  const error = response.error ?? response?.data?.error;
  if (!error) {
    return "";
  }
  if (Array.isArray(error)) {
    return error
      .map((item) => (typeof item === "string" ? item : JSON.stringify(item)))
      .filter(Boolean)
      .join(", ");
  }
  return typeof error === "string" ? error : JSON.stringify(error);
};

const resolveBooleanFlag = (value) => {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    const normalized = trimmed.toLowerCase();
    if (["true", "yes", "1", "✅"].includes(normalized) || trimmed === "✅") {
      return true;
    }
    if (["false", "no", "0"].includes(normalized)) {
      return false;
    }
    if (trimmed === "❌" || normalized === "❌") {
      return false;
    }
    return false;
  }
  if (typeof value === "number") {
    return value !== 0;
  }
  return false;
};

const filterReconciledReceipts = (records = []) =>
  records.filter((record) => {
    if (!resolveBooleanFlag(record?.Reconciliation1)) {
      return false;
    }
    const amount = Number(record?.Un_Utilised_Amount);
    return Number.isFinite(amount) && amount >= 1;
  });

const getCreatorModule = (creatorObj, moduleName) => {
  const candidates = [
    creatorObj,
    window.ZOHO?.CREATOR,
    window.ZOHO?.CreatorSDK,
    window.ZOHO,
    window,
  ];
  for (const candidate of candidates) {
    if (candidate?.[moduleName]) {
      return candidate[moduleName];
    }
    if (candidate?.CREATOR?.[moduleName]) {
      return candidate.CREATOR[moduleName];
    }
  }
  return null;
};

const resolveSendMailHandler = (creatorObj) => {
  const methodNames = ["sendMail", "sendmail", "send_email"];
  const modulesToCheck = [
    creatorObj,
    creatorObj?.UTIL,
    creatorObj?.API,
    creatorObj?.CREATOR,
    creatorObj?.CREATOR?.UTIL,
    creatorObj?.CREATOR?.API,
    getCreatorModule(creatorObj, "UTIL"),
    getCreatorModule(creatorObj, "API"),
    window.ZOHO?.CREATOR,
    window.ZOHO?.CREATOR?.UTIL,
    window.ZOHO?.CREATOR?.API,
    window.ZOHO?.CreatorSDK,
    window.ZOHO?.CreatorSDK?.UTIL,
    window.ZOHO?.CreatorSDK?.API,
    window.ZCAPI,
    window.ZCAPI?.UTIL,
    window.ZCAPI?.API,
  ];
  for (const module of modulesToCheck) {
    if (!module) continue;
    for (const method of methodNames) {
      if (typeof module[method] === "function") {
        return module[method].bind(module);
      }
    }
  }
  return null;
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const isRateLimitError = (error) => {
  if (!error) return false;
  const code =
    error.code ||
    error?.data?.code ||
    error?.response?.status ||
    error?.statusCode;
  const message =
    (error?.message || error?.data?.message || "").toString().toLowerCase();
  return (
    code === 429 ||
    code === 2930 ||
    message.includes("too many requests") ||
    message.includes("rate limit")
  );
};

const callWithRetry = async (fn, { maxRetries = 3, delayMs = 1200 } = {}) => {
  let attempt = 0;
  for (;;) {
    try {
      return await fn();
    } catch (error) {
      if (!isRateLimitError(error) || attempt >= maxRetries) {
        throw error;
      }
      const waitTime = delayMs * Math.pow(2, attempt);
      await sleep(waitTime);
      attempt += 1;
    }
  }
};

const getInvoiceClientIdentifier = (invoice) => {
  if (!invoice) {
    return "";
  }
  const extractValue = (candidate) => {
    if (candidate === undefined || candidate === null) {
      return "";
    }
    if (typeof candidate === "object") {
      const nestedCandidates = [
        candidate.Client_ID,
        candidate.ID,
        candidate.id,
        candidate.Client?.Client_ID,
        candidate.Client?.ID,
        candidate.Client?.id,
        candidate.Client_ID1,
        candidate.client_id,
        candidate.value,
        candidate.lookup_value,
      ];
      for (const nested of nestedCandidates) {
        const normalizedNested = normalizeRecordId(nested);
        if (normalizedNested) {
          return normalizedNested;
        }
      }
      return "";
    }
    return normalizeRecordId(candidate) || "";
  };
  const candidates = [
    invoice.Client?.Client_ID,
    invoice.Client?.Clientid,
    invoice.Client?.ID,
    invoice.Client_ID,
    invoice.Clientid,
    invoice.Client,
    invoice.Client_Details?.Client_ID,
    invoice.Client_Details?.ID,
    invoice.Client_Name,
  ];
  for (const candidate of candidates) {
    const normalized = extractValue(candidate);
    if (normalized) {
      return normalized;
    }
  }
  return "";
};

const resolveAddRecordHandler = (creatorObj) => {
  const methodNames = ["addRecord", "addRecords", "createRecord", "insertRecord"];
  const modulesToCheck = [
    creatorObj,
    creatorObj?.API,
    creatorObj?.DATA,
    creatorObj?.CREATOR,
    creatorObj?.CREATOR?.API,
    creatorObj?.CREATOR?.DATA,
    getCreatorModule(creatorObj, "API"),
    getCreatorModule(creatorObj, "DATA"),
    window.ZOHO?.CREATOR,
    window.ZOHO?.CREATOR?.API,
    window.ZOHO?.CREATOR?.DATA,
    window.ZOHO?.CreatorSDK,
    window.ZOHO?.CreatorSDK?.API,
    window.ZOHO?.CreatorSDK?.DATA,
    window.ZCAPI,
    window.ZCAPI?.API,
    window.ZCAPI?.DATA,
  ];

  for (const module of modulesToCheck) {
    if (!module) continue;
    for (const method of methodNames) {
      if (typeof module[method] === "function") {
        return module[method].bind(module);
      }
    }
  }

  return null;
};

const resolveUpdateRecordHandler = (creatorObj) => {
  const methodNames = [
    "updateRecordById",
    "updateRecord",
    "editRecord",
    "update",
    "updateRecords",
  ];
  const modulesToCheck = [
    creatorObj,
    creatorObj?.API,
    creatorObj?.DATA,
    creatorObj?.CREATOR,
    creatorObj?.CREATOR?.API,
    creatorObj?.CREATOR?.DATA,
    getCreatorModule(creatorObj, "API"),
    getCreatorModule(creatorObj, "DATA"),
    window.ZOHO?.CREATOR,
    window.ZOHO?.CREATOR?.API,
    window.ZOHO?.CREATOR?.DATA,
    window.ZOHO?.CreatorSDK,
    window.ZOHO?.CreatorSDK?.API,
    window.ZOHO?.CreatorSDK?.DATA,
    window.ZCAPI,
    window.ZCAPI?.API,
    window.ZCAPI?.DATA,
  ];

  for (const module of modulesToCheck) {
    if (!module) continue;
    for (const method of methodNames) {
      if (typeof module[method] === "function") {
        return module[method].bind(module);
      }
    }
  }

  return null;
};

const resolveDeleteRecordHandler = (creatorObj) => {
  const methodNames = ["deleteRecord", "deleteRecords", "removeRecord"];
  const modulesToCheck = [
    creatorObj,
    creatorObj?.API,
    creatorObj?.DATA,
    creatorObj?.CREATOR,
    creatorObj?.CREATOR?.API,
    creatorObj?.CREATOR?.DATA,
    getCreatorModule(creatorObj, "API"),
    getCreatorModule(creatorObj, "DATA"),
    window.ZOHO?.CREATOR,
    window.ZOHO?.CREATOR?.API,
    window.ZOHO?.CREATOR?.DATA,
    window.ZOHO?.CreatorSDK,
    window.ZOHO?.CreatorSDK?.API,
    window.ZOHO?.CreatorSDK?.DATA,
    window.ZCAPI,
    window.ZCAPI?.API,
    window.ZCAPI?.DATA,
  ];

  for (const module of modulesToCheck) {
    if (!module) continue;
    for (const method of methodNames) {
      if (typeof module[method] === "function") {
        return module[method].bind(module);
      }
    }
  }

  return null;
};

const resolveGetRecordByIdHandler = (creatorObj) => {
  const methodNames = [
    "getRecordById",
    "getRecord",
    "fetchRecordById",
    "getRecordDetails",
    "getRecords",
  ];
  const modulesToCheck = [
    creatorObj,
    creatorObj?.API,
    creatorObj?.DATA,
    creatorObj?.CREATOR,
    creatorObj?.CREATOR?.API,
    creatorObj?.CREATOR?.DATA,
    getCreatorModule(creatorObj, "API"),
    getCreatorModule(creatorObj, "DATA"),
    window.ZOHO?.CREATOR,
    window.ZOHO?.CREATOR?.API,
    window.ZOHO?.CREATOR?.DATA,
    window.ZOHO?.CreatorSDK,
    window.ZOHO?.CreatorSDK?.API,
    window.ZOHO?.CreatorSDK?.DATA,
    window.ZCAPI,
    window.ZCAPI?.API,
    window.ZCAPI?.DATA,
  ];

  for (const module of modulesToCheck) {
    if (!module) continue;
    for (const method of methodNames) {
      if (typeof module[method] === "function") {
        return module[method].bind(module);
      }
    }
  }

  return null;
};

const resolveUploadFileHandler = (creatorObj) => {
  const methodNames = ["uploadFile", "upload_file", "uploadFiles"];
  const modulesToCheck = [
    creatorObj,
    creatorObj?.API,
    creatorObj?.DATA,
    creatorObj?.CREATOR,
    creatorObj?.CREATOR?.API,
    creatorObj?.CREATOR?.DATA,
    getCreatorModule(creatorObj, "API"),
    window.ZOHO?.CREATOR,
    window.ZOHO?.CREATOR?.API,
    window.ZOHO?.CreatorSDK,
    window.ZOHO?.CreatorSDK?.API,
    window.ZCAPI,
    window.ZCAPI?.API,
  ];
  for (const module of modulesToCheck) {
    if (!module) continue;
    for (const method of methodNames) {
      if (typeof module[method] === "function") {
        return module[method].bind(module);
      }
    }
  }
  return null;
};

const resolveReadFileHandler = (creatorObj) => {
  const methodNames = ["readFile", "read_file", "downloadFile", "download_file"];
  const modulesToCheck = [
    creatorObj,
    creatorObj?.FILE,
    creatorObj?.API,
    creatorObj?.DATA,
    creatorObj?.CREATOR,
    creatorObj?.CREATOR?.FILE,
    creatorObj?.CREATOR?.API,
    creatorObj?.CREATOR?.DATA,
    getCreatorModule(creatorObj, "FILE"),
    getCreatorModule(creatorObj, "API"),
    window.ZOHO?.CREATOR,
    window.ZOHO?.CREATOR?.FILE,
    window.ZOHO?.CREATOR?.API,
    window.ZOHO?.CreatorSDK,
    window.ZOHO?.CreatorSDK?.FILE,
    window.ZOHO?.CreatorSDK?.API,
    window.ZCAPI,
    window.ZCAPI?.FILE,
    window.ZCAPI?.API,
  ];
  for (const module of modulesToCheck) {
    if (!module) continue;
    for (const method of methodNames) {
      if (typeof module[method] === "function") {
        return module[method].bind(module);
      }
    }
  }
  return null;
};

const buildLineItemsLookup = (items = []) => {
  const lookup = new Map();
  items.forEach((item) => {
    if (!item) return;
    const invoiceKey =
      item.Invoice?.ID ||
      item.Invoice_Id ||
      item.Invoice ||
      item.Invoice_Number ||
      item.Invoice_Name;
    if (!invoiceKey && invoiceKey !== 0) {
      return;
    }
    const key = String(invoiceKey);
    if (!lookup.has(key)) {
      lookup.set(key, []);
    }
    lookup.get(key).push(item);
  });
  return lookup;
};

const getLineItemsForInvoice = (lookup, invoice) => {
  if (!lookup || !invoice) {
    return [];
  }
  const candidates = [
    invoice.ID,
    invoice.Invoice_Number,
    invoice.Invoice?.ID,
    invoice.Invoice,
  ];
  for (const candidate of candidates) {
    if (candidate === undefined || candidate === null || candidate === "") {
      continue;
    }
    const key = String(candidate);
    if (lookup.has(key)) {
      return lookup.get(key);
    }
  }
  return [];
};

const buildCriteria = (field, value, options = {}) => {
  if (value === undefined || value === null || value === "") {
    return "";
  }
  const normalizedField = (field || "").toString().trim();
  const rawValue = String(value).trim();
  const defaultTreatAsString = /(^ID$|_ID$|Id$)/i.test(normalizedField);
  const treatAsString =
    typeof options.treatAsString === "boolean"
      ? options.treatAsString
      : defaultTreatAsString;
  const isNumeric = /^-?\d+(\.\d+)?$/.test(rawValue);
  const safeValue =
    !isNumeric || treatAsString
      ? `"${rawValue.replace(/"/g, '\\"')}"`
      : rawValue;
  return `(${normalizedField} == ${safeValue})`;
};

const CLIENT_FIELD_CANDIDATES = ["Clientid", "Client", "Client_ID"];

const buildClientCriteriaList = (
  value,
  fields = CLIENT_FIELD_CANDIDATES
) => {
  if (value === undefined || value === null || value === "") {
    return [];
  }
  const raw = String(value).trim();
  const isNumeric = /^-?\d+$/.test(raw);
  const criteria = [];
  fields.forEach((field) => {
    if (isNumeric) {
      const numericCriteria = buildCriteria(field, raw, {
        treatAsString: false,
      });
      if (numericCriteria) {
        criteria.push(numericCriteria);
      }
      const stringCriteria = buildCriteria(field, raw, {
        treatAsString: true,
      });
      if (stringCriteria) {
        criteria.push(stringCriteria);
      }
    } else {
      const defaultCriteria = buildCriteria(field, raw);
      if (defaultCriteria) {
        criteria.push(defaultCriteria);
      }
    }
  });
  const seen = new Set();
  return criteria.filter((item) => {
    if (!item) {
      return false;
    }
    if (seen.has(item)) {
      return false;
    }
    seen.add(item);
    return true;
  });
};

const combineCriteria = (...parts) =>
  parts
    .map((part) => (part ? part.trim() : ""))
    .filter(Boolean)
    .join(" && ");

const isNoRecordsError = (error) => {
  if (!error) {
    return false;
  }
  const codeCandidates = [
    error?.code,
    error?.data?.code,
    error?.response?.code,
    error?.response?.data?.code,
    error?.data?.error?.code,
    error?.error?.code,
  ];
  if (codeCandidates.some((code) => Number(code) === 9280)) {
    return true;
  }
  const statusCandidates = [
    error?.status,
    error?.statusCode,
    error?.response?.status,
    error?.response?.statusCode,
  ];
  const normalizedStatus = statusCandidates.find(
    (value) => Number(value) === 400
  );
  const messageCandidates = [
    error?.message,
    error?.description,
    error?.data?.message,
    error?.data?.description,
    error?.response?.data?.message,
    error?.response?.data?.description,
  ];
  const hasNoRecordMessage = messageCandidates.some((candidate) => {
    if (!candidate) {
      return false;
    }
    return candidate.toString().toLowerCase().includes("no records found");
  });
  if (hasNoRecordMessage) {
    return true;
  }
  if (normalizedStatus && !codeCandidates.some((code) => Number(code) === 3330)) {
    return true;
  }
  return false;
};

const isCriteriaError = (error) => {
  if (!error) {
    return false;
  }
  const message = (
    error?.message ||
    error?.data?.message ||
    ""
  ).toString().toLowerCase();
  return (
    error?.code === 3330 ||
    message.includes("invalid criteria") ||
    message.includes("variable") ||
    message.includes("column value") ||
    message.includes("left expression is of type")
  );
};

const parseEmailList = (value) => {
  if (!value) {
    return [];
  }
  return value
    .split(/[,;]/)
    .map((email) => email.trim())
    .filter(Boolean);
};

const getInvoiceIdentifier = (invoiceRecord) => {
  if (!invoiceRecord) {
    return "";
  }
  const candidates = [
    invoiceRecord.ID,
    invoiceRecord.Invoice?.ID,
    invoiceRecord.Invoice_ID,
    invoiceRecord.Invoice,
    invoiceRecord.Invoice_Number,
  ];
  for (const candidate of candidates) {
    if (
      candidate !== undefined &&
      candidate !== null &&
      candidate !== ""
    ) {
      return candidate;
    }
  }
  return "";
};

const createUtilizationFormData = (invoiceRecord = null) => {
  const invoiceId = getInvoiceIdentifier(invoiceRecord);
  const invoiceLabel =
    invoiceRecord?.Invoice_Number ||
    invoiceRecord?.Invoice?.zc_display_value ||
    invoiceRecord?.Invoice_Name ||
    (invoiceId ? `Invoice ${invoiceId}` : "");
  const agentId =
    invoiceRecord?.Agent?.ID ||
    invoiceRecord?.Agent_ID ||
    invoiceRecord?.Agent ||
    "";
  const clientId =
    invoiceRecord?.Client?.Client_ID ||
    invoiceRecord?.Client_ID ||
    invoiceRecord?.Client ||
    "";
  const invoiceDateInput = invoiceRecord?.Invoice_Date
    ? formatDateForInput(invoiceRecord.Invoice_Date)
    : formatDateForInput(new Date());
  return {
    Client_ID: clientId || "",
    Invoice_Number_Id: invoiceId || "",
    Invoice_Number_Label: invoiceLabel || "",
    Payment_Received: "",
    Utilization_Agent: agentId || "",
    Received_Amount: "",
    Utilization: "",
    Utilized_Amount: "",
    Total_Utilized_Amount: "",
    Receipt_Date: invoiceDateInput || "",
    Utilization_Note: "",
  };
};


const parseZohoErrorMessage = (err) => {
  if (!err) return "";
  if (typeof err === "string") return err;
  const nestedError =
    err?.message ||
    err?.data?.message ||
    err?.data?.error?.message ||
    "";
  if (Array.isArray(err?.error)) {
    const alertEntry = err.error.find(
      (item) => item?.task === "alert" && item.alert_message
    );
    if (alertEntry) {
      if (Array.isArray(alertEntry.alert_message)) {
        return alertEntry.alert_message.join(", ");
      }
      return alertEntry.alert_message;
    }
  }
  if (Array.isArray(err?.data?.error)) {
    const alertEntry = err.data.error.find(
      (item) => item?.task === "alert" && item.alert_message
    );
    if (alertEntry) {
      if (Array.isArray(alertEntry.alert_message)) {
        return alertEntry.alert_message.join(", ");
      }
      return alertEntry.alert_message;
    }
  }
  return nestedError || "";
};

const computeUtilizedAmount = (records = []) => {
  if (!Array.isArray(records)) {
    return 0;
  }
  return records.reduce((total, record) => {
    if (!record) {
      return total;
    }
    let numericValue = 0;
    const candidates = [
      record.Utilized_Amount,
      record.Utilization,
      record.Utilization_Amount,
      record.Utilized,
    ];
    for (const candidate of candidates) {
      const parsed = Number(candidate);
      if (Number.isFinite(parsed)) {
        numericValue = parsed;
        break;
      }
    }
    return total + numericValue;
  }, 0);
};

function Invoices({ clientId, serviceId, clientDetails, serviceDetails }) {
  const [invoices, setInvoices] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [editorMode, setEditorMode] = useState("create");
  const [editingInvoice, setEditingInvoice] = useState(null);
  const [isInvoiceEditorLoading, setInvoiceEditorLoading] = useState(false);
  const [invoiceEditorError, setInvoiceEditorError] = useState(null);
  const zohoInitPromiseRef = useRef(null);
  const [isCreateModalOpen, setCreateModalOpen] = useState(false);
  const [agentOptions, setAgentOptions] = useState([]);
  const [serviceOptions, setServiceOptions] = useState([]);
  const [invoiceLineItemsCache, setInvoiceLineItemsCache] = useState([]);
  const [selectedUtilizationInvoice, setSelectedUtilizationInvoice] =
    useState(null);
  const [selectedUtilizations, setSelectedUtilizations] = useState([]);
  const [isUtilizationLoading, setIsUtilizationLoading] = useState(false);
  const [utilizationError, setUtilizationError] = useState(null);
  const [isUtilizationModalOpen, setUtilizationModalOpen] = useState(false);
  const [utilizationModalInvoice, setUtilizationModalInvoice] = useState(null);
  const [utilizationFormData, setUtilizationFormData] = useState(null);
  const [utilizationModalError, setUtilizationModalError] = useState(null);
  const [isUtilizationSaving, setUtilizationSaving] = useState(false);
  const [paymentReceiptOptions, setPaymentReceiptOptions] = useState([]);
  const [isPaymentReceiptsLoading, setPaymentReceiptsLoading] = useState(false);
  const [utilizationUploadFile, setUtilizationUploadFile] = useState(null);
  const [isEmailModalOpen, setEmailModalOpen] = useState(false);
  const [invoiceEmailFormData, setInvoiceEmailFormData] = useState(null);
  const [invoiceEmailError, setInvoiceEmailError] = useState(null);
  const [isInvoiceEmailSending, setInvoiceEmailSending] = useState(false);
  const [invoiceEmailTemplates, setInvoiceEmailTemplates] = useState([]);
  const [invoiceEmailPlaceholderValues, setInvoiceEmailPlaceholderValues] =
    useState(null);
  const serviceIdRef = useRef(null);
  const clientDetailsRef = useRef(null);
  const serviceDetailsRef = useRef(null);
  const utilizationCacheRef = useRef(new Map());
  const utilizationFetchPromiseRef = useRef(new Map());
  const signatureCacheRef = useRef(new Map());
  const invoiceFetchStateRef = useRef({ clientId: null, fetched: false });
  useEffect(() => {
    serviceIdRef.current = normalizeRecordId(serviceId);
  }, [serviceId]);
  useEffect(() => {
    clientDetailsRef.current = clientDetails || null;
  }, [clientDetails]);
  useEffect(() => {
    serviceDetailsRef.current = serviceDetails || null;
  }, [serviceDetails]);
  useEffect(() => {
    utilizationCacheRef.current.clear();
    utilizationFetchPromiseRef.current.clear();
  }, [clientId]);


  
  const INVOICE_REPORT_NAME = "All_Invoices";
  const USERS_REPORT_NAME = "All_Users";
  const SERVICES_REPORT_NAME = "All_Service_Masters";
  const INVOICE_FORM_NAME = "Add_Invoice";
  const INVOICE_LINE_FORM_NAME = "Invoice_Line_Items";
  const INVOICE_LINE_REPORT_NAME = "Invoice_Line_Items1";
   const PAYMENT_UTILIZATION_FORM_NAME = "Payment_Utilization";
  const PAYMENT_UTILIZATION_REPORT_NAME = "Payment_Utilizations";
  const PAYMENT_UTILIZATION_FILE_FIELD = "Upload_File";
  const PAYMENT_RECEIPT_REPORT_NAME = "Payments_Received";
  const SEND_EMAIL_FORM_NAME = "Send_Email";


  const formatCurrency = useCallback((value) => {
    const amount = Number(value);
    if (Number.isNaN(amount)) {
      return "-";
    }
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 2,
    }).format(amount);
  }, []);

  const ensureAbsoluteUrl = useCallback((url) => {
    if (!url) {
      return "";
    }
    if (/^data:/i.test(url) || /^https?:\/\//i.test(url)) {
      return url;
    }
    if (url.startsWith("//")) {
      return `${window?.location?.protocol || "https:"}${url}`;
    }
    const origin =
      window?.ZOHO?.CREATOR?.config?.creatorOrigin ||
      window?.ZOHO?.CREATOR?.config?.apporigin ||
      window?.location?.origin ||
      "https://creatorapp.zoho.com.au";
    if (url.startsWith("/")) {
      return `${origin}${url}`;
    }
    return `${origin}/${url}`;
  }, []);

const extractSignaturePointer = (value) => {
  if (typeof value !== "string") {
    return null;
  }
  const reportMatch = value.match(
    /\/report\/([^/]+)\/([^/]+)\/([^/]+)\/download/i
  );
  if (!reportMatch) {
    return null;
  }
  const [, reportName, recordIdFromPath, fieldName] = reportMatch;
  const filePathMatch = value.match(/filepath=([^&]+)/i);
  return {
    reportName,
    recordIdFromPath,
    fieldName,
    filePath: filePathMatch ? decodeURIComponent(filePathMatch[1]) : null,
  };
};

  const resolveSignatureMarkup = useCallback(
    (signatureField) => {
      if (!signatureField) {
        return "";
      }
      const buildImageMarkup = (url) => {
        if (!url) return "";
        const resolvedUrl = ensureAbsoluteUrl(url);
        return `<img src="${resolvedUrl}" alt="Signature" style="max-height:90px;display:inline-block;" />`;
      };
      const stringLooksLikePath = (value) => {
        if (!value) {
          return false;
        }
        const trimmed = value.trim();
        return (
          /^data:/i.test(trimmed) ||
          /^https?:\/\//i.test(trimmed) ||
          trimmed.startsWith("//") ||
          trimmed.startsWith("/") ||
          trimmed.includes("/api/") ||
          /\.(png|jpe?g|gif|bmp|svg|webp)(\?.*)?$/i.test(trimmed)
        );
      };
      const extractFromObject = (value) => {
        if (!value) {
          return "";
        }
        if (typeof value === "string") {
          const trimmed = value.trim();
          if (stringLooksLikePath(trimmed)) {
            return buildImageMarkup(trimmed);
          }
          return trimmed;
        }
        if (Array.isArray(value)) {
          for (const entry of value) {
            const resolved = extractFromObject(entry);
            if (resolved) {
              return resolved;
            }
          }
          return "";
        }
        if (typeof value === "object") {
          const url =
            value.download_url ||
            value.Download_URL ||
            value.url ||
            value.URL ||
            value.view_url ||
            value.View_URL ||
            value.image_url ||
            value.Image_URL ||
            value.file_download_url ||
            value.File_Download_URL ||
            value.File_Download_URL;
          if (url) {
            return buildImageMarkup(url);
          }
          const display =
            value.display_value ||
            value.zc_display_value ||
            value.File_Name ||
            value.name ||
            value.Signature ||
            "";
          if (display) {
            if (stringLooksLikePath(display)) {
              return buildImageMarkup(display);
            }
            return display;
          }
        }
        return "";
      };
      return extractFromObject(signatureField);
    },
    [ensureAbsoluteUrl]
  );

  const buildInvoiceEmailContent = useCallback(
    (invoice) => {
      const clientName =
        invoice.Billing_Name ||
        invoice.Client?.Client_Name ||
        invoice.Client?.Name ||
        "Client";
      const invoiceNumber =
        invoice.Invoice_Number ||
        invoice.Invoice?.Invoice_Number ||
        invoice.ID ||
        "";
      const amountText = formatCurrency(invoice.Total_Amount);
      return `Dear ${clientName},

Please find your invoice ${
        invoiceNumber ? `(${invoiceNumber})` : ""
      } totaling ${amountText}.

If you have any questions, feel free to reply to this email.

Thank you.`;
    },
    [formatCurrency]
  );

  const ensureZohoReady = useCallback(async () => {
    if (!window.ZOHO?.CREATOR) {
      throw new Error("Zoho Creator SDK not available on window.");
    }

    if (!zohoInitPromiseRef.current) {
      if (typeof window.ZOHO.CREATOR.init === "function") {
        zohoInitPromiseRef.current = window.ZOHO.CREATOR.init().then(
          (result) => {
            if (result?.CREATOR) {
              return result.CREATOR;
            }
            if (result) {
              return result;
            }
            return window.ZOHO.CREATOR;
          }
        );
      } else {
        zohoInitPromiseRef.current = Promise.resolve(window.ZOHO.CREATOR);
      }
    }

    return zohoInitPromiseRef.current;
  }, []);

  const fetchSignatureMarkup = useCallback(
    async (invoiceRecord) => {
      if (!invoiceRecord) {
        return "";
      }
      const signatureField = invoiceRecord.Agent?.Signature;
      const directMarkup = resolveSignatureMarkup(signatureField);
      if (directMarkup && directMarkup.includes("<img")) {
        return directMarkup;
      }
      const agentId = normalizeRecordId(
        invoiceRecord.Agent?.ID ||
          invoiceRecord.Agent_ID ||
          invoiceRecord.Agent
      );
      const pointer = extractSignaturePointer(
        typeof signatureField === "string" ? signatureField : ""
      );
      const cacheKey = pointer?.recordIdFromPath || agentId;
      if (cacheKey && signatureCacheRef.current.has(cacheKey)) {
        return signatureCacheRef.current.get(cacheKey) || "";
      }
      if (!agentId && !pointer?.recordIdFromPath) {
        return "";
      }
      try {
        const creator = await ensureZohoReady();
        const readFileHandler = resolveReadFileHandler(creator);
        if (!readFileHandler) {
          return "";
        }
        const appName = getAppLinkName() || "knowbal-one";
        const recordId = pointer?.recordIdFromPath || agentId;
        const config = {
          app_name: appName,
          appName,
          report_name: pointer?.reportName || USERS_REPORT_NAME,
          reportName: pointer?.reportName || USERS_REPORT_NAME,
          form_name: pointer?.reportName || USERS_REPORT_NAME,
          formName: pointer?.reportName || USERS_REPORT_NAME,
          id: recordId,
          record_id: recordId,
          field_name: pointer?.fieldName || "Signature",
          fieldName: pointer?.fieldName || "Signature",
        };
        if (pointer?.filePath) {
          config.file_path = pointer.filePath;
          config.filepath = pointer.filePath;
        }
        const response = await readFileHandler(config);
        const fileContent =
          response?.data?.file_content ||
          response?.data?.File_Content ||
          response?.file_content ||
          response?.File_Content ||
          response?.data?.content ||
          response?.content ||
          "";
        const mimeType =
          response?.data?.content_type ||
          response?.data?.Content_Type ||
          response?.content_type ||
          "image/png";
        let markup = "";
        if (fileContent) {
          markup = `<img src="data:${mimeType};base64,${fileContent}" alt="Signature" style="max-height:90px;display:inline-block;" />`;
        } else {
          const downloadUrl =
            response?.data?.download_url ||
            response?.data?.view_url ||
            response?.data?.url ||
            response?.download_url ||
            response?.view_url ||
            response?.url ||
            pointer?.filePath ||
            "";
          if (downloadUrl) {
            markup = resolveSignatureMarkup(downloadUrl);
          }
        }
        if (cacheKey) {
          signatureCacheRef.current.set(cacheKey, markup || "");
        }
        return markup || "";
      } catch (err) {
        console.warn("Unable to read agent signature file", err);
        if (cacheKey) {
          signatureCacheRef.current.set(cacheKey, "");
        }
        return "";
      }
    },
    [ensureZohoReady, resolveSignatureMarkup]
  );

  const loadInvoiceEmailTemplates = useCallback(async () => {
    try {
      const creator = await ensureZohoReady();
      const dataModule = getCreatorModule(creator, "DATA");
      if (!dataModule?.getRecords) {
        throw new Error("Zoho DATA.getRecords API unavailable.");
      }
      const response = await callWithRetry(() =>
        dataModule.getRecords({
          report_name: "All_Email_Templates",
        })
      );
      const templates = response?.data || [];
      setInvoiceEmailTemplates(templates);
      return templates;
    } catch (err) {
      console.warn("Unable to fetch invoice email templates", err);
      setInvoiceEmailTemplates([]);
      return [];
    }
  }, [ensureZohoReady]);






  const normalizeZohoRecordResponse = (response) => {
    if (!response) {
      return null;
    }
    if (Array.isArray(response)) {
      return response[0] || null;
    }
    if (Array.isArray(response?.data)) {
      return response.data[0] || null;
    }
    if (response?.data && typeof response.data === "object") {
      return response.data;
    }
    return response;
  };

  const fetchAllRecordsForReport = async ({
    dataModule,
    reportName,
    perPage = 200,
    maxPages = 25,
    criteria = "",
  }) => {
    if (!dataModule?.getRecords) {
      return [];
    }
    const records = [];
    let page = 1;
    while (page <= maxPages) {
      const requestPayload = {
        report_name: reportName,
        page,
        per_page: perPage,
      };
      if (criteria) {
        requestPayload.criteria = criteria;
      }
      const response = await callWithRetry(() =>
        dataModule.getRecords(requestPayload)
      );
      const data = response?.data ?? [];
      records.push(...data);
      if (data.length < perPage) {
        break;
      }
      page += 1;
    }
    return records;
  };


  const invoiceLineItemsLookup = useMemo(
    () => buildLineItemsLookup(invoiceLineItemsCache),
    [invoiceLineItemsCache]
  );

  const normalizedClientId = useMemo(
    () => normalizeRecordId(clientId),
    [clientId]
  );

  const serviceLookup = useMemo(() => {
    const lookup = new Map();
    serviceOptions.forEach((service) => {
      if (!service || !service.__optionId) return;
      lookup.set(String(service.__optionId), service.__optionLabel || "");
    });
    return lookup;
  }, [serviceOptions]);

  const enrichLineItemsWithServiceDetails = useCallback(
    (Invoice_Line_Items = []) =>
      Invoice_Line_Items.map((item) => {
        const serviceId =
          item.Service_Id ||
          item.Service?.ID ||
          item.Service?.id ||
          item.Service ||
          item.Service_ID ||
          item.Service_Number ||
          "";
        const normalizedId =
          serviceId === undefined || serviceId === null || serviceId === ""
            ? ""
            : String(serviceId);
        const serviceLabel =
          item.Service?.zc_display_value ||
          serviceLookup.get(normalizedId) ||
          item.Service_Name ||
          item.Service ||
          "";
        return {
          ...item,
          Service_Id: normalizedId,
          Service:
            serviceLabel ||
            item.Service ||
            item.Service_Name ||
            normalizedId,
          Service_Name: serviceLabel || item.Service_Name || "",
          Service_Search:
            item.Service_Search || serviceLabel || item.Service || "",
        };
      }),
    [serviceLookup]
  );

    const getAgentOptionId = useCallback((candidate) => {
      if (candidate === undefined || candidate === null || candidate === "") {
        return "";
      }
      if (typeof candidate === "string" || typeof candidate === "number") {
        return normalizeRecordId(candidate);
      }
      return (
        normalizeRecordId(
          candidate.__optionId ??
            candidate.ID ??
            candidate.id ??
            candidate.User_ID ??
            candidate.user_id
        ) || ""
      );
    }, []);
  

    const getAgentOptionLabel = useCallback((candidate) => {
      if (!candidate) {
        return "";
      }
      if (typeof candidate === "string" || typeof candidate === "number") {
        const id = normalizeRecordId(candidate);
        if (!id) return "";
        const match =
          (agentOptions || []).find((agent) => agent.__optionId === id) || null;
        return match?.__optionLabel || `User ${id}`;
      }
      const nameField =
        candidate.Name1 && typeof candidate.Name1 === "object"
          ? candidate.Name1
          : null;
      const fallbackId = getAgentOptionId(candidate);
      return (
        candidate.__optionLabel ??
        candidate.zc_display_value ??
        candidate.display_value ??
        candidate.Full_Name ??
        candidate.full_name ??
        nameField?.zc_display_value ??
        nameField?.full_name ??
        // compositeName ||
        candidate.Name ??
        candidate.name ??
        candidate.User_Name ??
        candidate.user_name ??
        candidate.Email ??
        candidate.email ??
        `User ${fallbackId || ""}`.trim()
      );
    }, [agentOptions, getAgentOptionId]);
  

 const normalizeAgentRecord = useCallback((candidate) => {
    if (!candidate) {
      return null;
    }
    let id = "";
    if (typeof candidate === "string" || typeof candidate === "number") {
      id = normalizeRecordId(candidate);
    } else {
      id = getAgentOptionId(candidate);
    }
    if (!id) {
      return null;
    }
    const existing =
      agentOptions.find((agent) => agent.__optionId === id) || null;
    if (existing) {
      return existing;
    }
    const label =
      (typeof candidate === "object" && getAgentOptionLabel(candidate)) ||
      `User ${id}`;
    return {
      ...(typeof candidate === "object" ? candidate : {}),
      ID: id,
      id: id,
      __optionId: id,
      __optionLabel: label,
      zc_display_value: label,
      display_value: label,
    };
  }, [agentOptions, getAgentOptionId, getAgentOptionLabel]);

  const fetchInvoicesData = useCallback(async () => {
    if (!normalizedClientId) {
      setInvoices([]);
      setError(null);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const creator = await ensureZohoReady();
      const dataModule = getCreatorModule(creator, "DATA");
      if (!dataModule?.getRecords) {
        throw new Error("Zoho DATA.getRecords API unavailable.");
      }
      const clientCriteriaCandidates = buildClientCriteriaList(
        normalizedClientId,
        ["Clientid"]
      );
      if (!clientCriteriaCandidates.length) {
        throw new Error("Unable to resolve client criteria for invoices.");
      }
      let invoiceResponse = null;
      let lastCriteriaError = null;
      let encounteredNoRecords = false;
      for (const clientCriteria of clientCriteriaCandidates) {
        try {
          invoiceResponse = await callWithRetry(() =>
            dataModule.getRecords({
              report_name: INVOICE_REPORT_NAME,
              criteria: clientCriteria,
            })
          );
          break;
        } catch (candidateError) {
          if (isNoRecordsError(candidateError)) {
            lastCriteriaError = candidateError;
            encounteredNoRecords = true;
            break;
          }
          if (isCriteriaError(candidateError)) {
            lastCriteriaError = candidateError;
            continue;
          }
          throw candidateError;
        }
      }
      if (!invoiceResponse) {
        if (lastCriteriaError && isNoRecordsError(lastCriteriaError)) {
          encounteredNoRecords = true;
        } else {
          throw lastCriteriaError || new Error("Unable to fetch invoices.");
        }
      }
      const invoiceRecords = encounteredNoRecords
        ? []
        : invoiceResponse?.data ?? [];
      setInvoices(invoiceRecords);
      if (encounteredNoRecords) {
        setError("No invoices found.");
      }
      const usersResponse = await dataModule.getRecords({
        report_name: USERS_REPORT_NAME,
        criteria: '(Status == "Active")',
      });
     if (usersResponse && usersResponse.data) {
            const seenUserIds = new Set();
            const normalizedUsers = [];
            usersResponse.data.forEach((user) => {
              const normalized = normalizeAgentRecord(user);
              if (normalized && normalized.__optionId && !seenUserIds.has(normalized.__optionId)) {
                seenUserIds.add(normalized.__optionId);
                normalizedUsers.push(normalized);
              }
            });
            setAgentOptions(normalizedUsers);
          }
   
      
      const servicesResponse = await dataModule.getRecords({
        report_name: SERVICES_REPORT_NAME,
      });
  
      
      if (servicesResponse?.data) {
        const normalizedServices = servicesResponse.data
          .map((service) => {
            if (!service?.ID) return null;
            const label =
              service.Service?.zc_display_value ||
              service.Service ||
              service.Service_Name ||
              `Service ${service.ID}`;
            return {
              __optionId: service.ID,
              __optionLabel: label,
            };
          })
          .filter(Boolean);
        setServiceOptions(normalizedServices);
      }
    } catch (err) {
      if (isNoRecordsError(err)) {
        setError("No invoices found.");
        setInvoices([]);
      } else if (isRateLimitError(err)) {
        setError(
          "Invoices temporarily unavailable due to Zoho rate limiting. Please try again shortly."
        );
        setInvoices([]);
      } else {
        setError(err.message || "Unable to fetch invoices.");
        setInvoices([]);
      }
    } finally {
      setIsLoading(false);
    }
  }, [ensureZohoReady, normalizedClientId, normalizeAgentRecord]);

  const fetchPaymentUtilizations = useCallback(
    async (invoiceRecord, { forceRefresh = false } = {}) => {
      const invoiceIdentifier = getInvoiceIdentifier(invoiceRecord);
      if (!invoiceIdentifier || !normalizedClientId) {
        return [];
      }
      const cacheKey = `${normalizedClientId}::${invoiceIdentifier}`;
      if (!forceRefresh && utilizationCacheRef.current.has(cacheKey)) {
        return utilizationCacheRef.current.get(cacheKey);
      }
      if (!forceRefresh && utilizationFetchPromiseRef.current.has(cacheKey)) {
        return utilizationFetchPromiseRef.current.get(cacheKey);
      }
      if (forceRefresh) {
        utilizationCacheRef.current.delete(cacheKey);
        utilizationFetchPromiseRef.current.delete(cacheKey);
      }

      const fetchPromise = (async () => {
        const clientCriteriaCandidates = buildClientCriteriaList(
          normalizedClientId,
          ["Clientid"]
        );
        if (!clientCriteriaCandidates.length) {
          utilizationCacheRef.current.set(cacheKey, []);
          return [];
        }
        const creator = await ensureZohoReady();
        const dataModule = getCreatorModule(creator, "DATA");
        if (!dataModule?.getRecords) {
          throw new Error("Zoho DATA.getRecords API unavailable.");
        }
        const candidateFields = ["Invoice_Number"];
        const isTypeMismatchMessage = (message = "") => {
          const normalized = message.toLowerCase();
          return (
            normalized.includes("left expression is of type") ||
            normalized.includes("right expression is of type")
          );
        };
        for (const field of candidateFields) {
          const treatOptions = [false, true];
          for (const treatAsStringOption of treatOptions) {
            const invoiceCriteria = buildCriteria(field, invoiceIdentifier, {
              treatAsString: treatAsStringOption,
            });
            if (!invoiceCriteria) {
              continue;
            }
            for (const clientCriteria of clientCriteriaCandidates) {
              const combinedCriteria = combineCriteria(
                clientCriteria,
                invoiceCriteria
              );
              try {
                const response = await dataModule.getRecords({
                  report_name: PAYMENT_UTILIZATION_REPORT_NAME,
                  criteria: combinedCriteria,
                  page: 1,
                  per_page: 200,
                });
                if (Array.isArray(response?.data)) {
                  const result = response.data || [];
                  utilizationCacheRef.current.set(cacheKey, result);
                  return result;
                }
              } catch (candidateError) {
                const errorMessage =
                  candidateError?.message ||
                  candidateError?.data?.message ||
                  "";
                const normalized = errorMessage.toLowerCase();
                const criteriaIssue =
                  candidateError?.code === 3330 ||
                  normalized.includes("invalid criteria") ||
                  normalized.includes("variable") ||
                  normalized.includes("column value") ||
                  isTypeMismatchMessage(errorMessage);
                if (criteriaIssue) {
                  continue;
                }
                throw candidateError;
              }
            }
          }
        }
        utilizationCacheRef.current.set(cacheKey, []);
        return [];
      })()
        .catch((error) => {
          utilizationCacheRef.current.delete(cacheKey);
          throw error;
        })
        .finally(() => {
          utilizationFetchPromiseRef.current.delete(cacheKey);
        });

      utilizationFetchPromiseRef.current.set(cacheKey, fetchPromise);
      return fetchPromise;
    },
    [ensureZohoReady, normalizedClientId]
  );

  const fetchAllPaymentReceipts = useCallback(async () => {
    if (!normalizedClientId) {
      return [];
    }
    const creator = await ensureZohoReady();
    const dataModule = getCreatorModule(creator, "DATA");
    if (!dataModule?.getRecords) {
      throw new Error("Zoho DATA.getRecords API unavailable.");
    }
    const clientCriteriaCandidates = buildClientCriteriaList(
      normalizedClientId
    );
    if (!clientCriteriaCandidates.length) {
      return [];
    }
    for (const clientCriteria of clientCriteriaCandidates) {
      try {
        const receipts = await fetchAllRecordsForReport({
          dataModule,
          reportName: PAYMENT_RECEIPT_REPORT_NAME,
          criteria: clientCriteria,
        });
        return filterReconciledReceipts(receipts);
      } catch (error) {
        if (isCriteriaError(error)) {
          continue;
        }
        throw error;
      }
    }
    return [];
  }, [ensureZohoReady, normalizedClientId]);

  const uploadUtilizationAttachment = useCallback(
    async ({ recordId, file }) => {
      if (!recordId || !file) {
        return;
      }
      const creator = await ensureZohoReady();
      const uploadHandler =
        creator?.FILE?.uploadFile ||
        creator?.FILE?.upload_file ||
        creator?.FILE?.uploadFiles ||
        window?.ZOHO?.CREATOR?.FILE?.uploadFile ||
        creator?.ZOHO?.CREATOR?.FILE?.uploadFile ||
        resolveUploadFileHandler(creator);
      if (!uploadHandler) {
        throw new Error("Unable to locate file upload handler.");
      }
      const appName = getAppLinkName() || "knowbal-one";
      const requestConfig = {
        app_name: appName,
        appName,
        report_name: PAYMENT_UTILIZATION_REPORT_NAME,
        reportName: PAYMENT_UTILIZATION_REPORT_NAME,
        form_name: PAYMENT_UTILIZATION_FORM_NAME,
        formName: PAYMENT_UTILIZATION_FORM_NAME,
        record_id: recordId,
        recordId,
        id: recordId,
        field_name: PAYMENT_UTILIZATION_FILE_FIELD,
        fieldName: PAYMENT_UTILIZATION_FILE_FIELD,
        file,
      };
      return uploadHandler(requestConfig);
    },
    [ensureZohoReady]
  );

  useEffect(() => {
    if (!normalizedClientId) {
      invoiceFetchStateRef.current = { clientId: null, fetched: false };
      return;
    }
    if (
      invoiceFetchStateRef.current.clientId === normalizedClientId &&
      invoiceFetchStateRef.current.fetched
    ) {
      return;
    }
    invoiceFetchStateRef.current = {
      clientId: normalizedClientId,
      fetched: true,
    };
    fetchInvoicesData();
  }, [fetchInvoicesData, normalizedClientId]);

  const buildInvoiceFormPayload = (invoice) => {

    const resolvedAgentId =
      invoice.Agent?.ID || invoice.Agent_ID || invoice.Agent || "";
    const payload = {
      Agent_ID: resolvedAgentId || "",
      Agent: resolvedAgentId || "",
      Invoice_Date: formatDateForZoho(invoice.Invoice_Date) || "",
      Billing_Name: invoice.Billing_Name || "",
      Billing_Address_Line_1: invoice.Billing_Address_Line_1 || "",
      Billing_Address_Line_2: invoice.Billing_Address_Line_2 || "",
      City: invoice.City || "",
      State: invoice.State || "",
      Postal_Code: invoice.Postal_Code || "",
      Country: invoice.Country || "",
      Billing_Address: buildBillingAddressPayload(invoice),
      Email: invoice.Email || "",
      Phone_Number: invoice.Phone_Number || invoice.Phone || "",
      Phone_Country_Code: invoice.Phone_Country_Code || "",
      Promo_Code: invoice.Promo_Code || "",
      Invoice_Notes: invoice.Invoice_Notes || "",
      Total_Amount: invoice.Total_Amount || 0,
      Client:clientId
    };

    return payload;
  };

  const filteredInvoices = useMemo(() => {
    return invoices.filter((invoice) => {
      if (
        normalizedClientId &&
        getInvoiceClientIdentifier(invoice) !== normalizedClientId
      ) {
        return false;
      }
      return true;
    });
  }, [invoices, normalizedClientId]);

  const buildLineItemPayload = (item, invoiceId) => ({
    Invoice: invoiceId,
    Service: item.Service_Id || item.Service || "",
    Service_Description:
      item.Description ||
      item.Service_Description ||
      item.Service?.zc_display_value ||
      item.Service ||
      "",
    Price: Number(item.Price) || 0,
    Discount: item.Discount || item.Discount_Percentage || "0",
    Discount_Amount: item.Discount_Amount || "",
    GST_Type: item.GST_Type || item.GST || "Inclusive",
    GST: item.GST_Type || item.GST || "Inclusive",
    GST_Amount: Number(item.GST_Amount) || 0,
    Amount: Number(item.Amount ?? item.Line_Total ?? 0) || 0,
    Net_Amount: Number(item.Net_Amount ?? item.Net_Total ?? 0) || 0,
    S_No: item.S_No || 0,
    Item_Notes: item.Item_Notes || item.Notes || "",
  });

  const handleInvoiceEmailFieldChange = (field, value) => {
    setInvoiceEmailFormData((prev) => ({
      ...(prev || {}),
      [field]: value,
    }));
  };

  const closeInvoiceEmailModal = () => {
    setEmailModalOpen(false);
    setInvoiceEmailFormData(null);
    setInvoiceEmailError(null);
    setInvoiceEmailSending(false);
  };


        
  const openInvoiceEmailModal = useCallback(
    async (invoice) => {
      if (!invoice) return;
      try {
        let templates = invoiceEmailTemplates;
        if (!templates.length) {
          templates = (await loadInvoiceEmailTemplates()) || [];
        }
        const assignedAgentId =
          invoice?.Agent?.ID || invoice.Agent_ID || invoice.Agent || "";
        const normalizedAgentId = normalizeRecordId(
          invoice.Agent?.ID || invoice.Agent_ID || invoice.Agent
        );
        const agentEmailFromOptions =
          agentOptions.find(
            (agent) =>
              agent.__optionId === normalizedAgentId &&
              agent.Login_Email_Address
          )?.Login_Email_Address || "";
        const clientEmail =
          clientDetails?.Email ||
          invoice.Email ||
          invoice.Client?.Email ||
          invoice.Client_Email ||
          "";
        const clientName =
          invoice.Billing_Name ||
          invoice.Client?.Client_Name ||
          invoice.Client?.Name ||
          "";
        const signatureMarkup =
          (await fetchSignatureMarkup(invoice)) ||
          resolveSignatureMarkup(invoice.Agent?.Signature);
        const placeholderValues = {
          NAME: clientName,
          SERVICE:
            invoice.Service?.Service ||
            invoice.Service_Name ||
            invoice.Service ||
            "",
          SIGNATURE: signatureMarkup,
        };
        const applyPlaceholders = (text = "") => {
          if (!text) {
            return text;
          }
          let output = text
            .replace(/\{NAME\}/gi, placeholderValues.NAME || "")
            .replace(/\{SERVICE\}/gi, placeholderValues.SERVICE || "");
          const signatureValue = placeholderValues.SIGNATURE || "";
          if (signatureValue !== undefined) {
            const signaturePatterns = [
              /\{\s*Signature\s*\}/gi,
              /\{\{\s*Signature\s*\}\}/gi,
              /\[\[\s*Signature\s*\]\]/gi,
            ];
            signaturePatterns.forEach((pattern) => {
              output = output.replace(pattern, signatureValue || "");
            });
          }
          return output;
        };
        let templateId = "";
        let resolvedSubject =
          invoice.Invoice_Number
            ? `Invoice ${invoice.Invoice_Number}`
            : "Invoice Details";
        let resolvedContent = buildInvoiceEmailContent(invoice);
        if (templates.length) {
          const invoiceTemplate = templates.find((template) => {
            const templateName =
              template?.Template_Name ||
              template?.Template ||
              template?.Name ||
              "";
            return (
              templateName &&
              templateName.toString().toLowerCase().includes("invoice template")
            );
          });
          templateId =
            invoiceTemplate?.ID ||
            invoiceTemplate?.id ||
            invoiceTemplate?.Template_ID ||
            invoiceTemplate?.Templateid ||
            "";
          if (invoiceTemplate) {
            const templateSubject =
              invoiceTemplate.Subject ||
              invoiceTemplate.Template_Subject ||
              invoiceTemplate.Subject_field ||
              invoiceTemplate.Template_Name ||
              "";
            const templateContent =
              invoiceTemplate.Email_Content ||
              invoiceTemplate.Template_Content ||
              invoiceTemplate.Template_Body ||
              "";
            if (templateSubject) {
              resolvedSubject = applyPlaceholders(templateSubject);
            }
            if (templateContent) {
              resolvedContent = applyPlaceholders(templateContent);
            }
          }
        }
        setInvoiceEmailFormData({
          Invoice_ID: invoice.ID || "",
          Request_ID: invoice.ID || "",
          Assigned_User: assignedAgentId,
          Client_Name: clientName,
          From: agentEmailFromOptions,
          To: clientEmail,
          Subject: resolvedSubject,
          Content: resolvedContent,
          TemplateId: templateId || "",
          CC: "",
        });
        setInvoiceEmailPlaceholderValues(placeholderValues);
        setInvoiceEmailError(null);
        setInvoiceEmailSending(false);
        setEmailModalOpen(true);
      } catch (err) {
        console.warn("Unable to prepare invoice email", err);
        setInvoiceEmailError(err?.message || "Unable to prepare invoice email.");
      }
    },
    [
      agentOptions,
      clientDetails,
      fetchSignatureMarkup,
      invoiceEmailTemplates,
      loadInvoiceEmailTemplates,
      buildInvoiceEmailContent,
      resolveSignatureMarkup,
    ]
  );

  const handleSendInvoiceEmail = async () => {
    if (!invoiceEmailFormData) {
      return;
    }
    const toList = parseEmailList(invoiceEmailFormData.To);
    if (!invoiceEmailFormData.From) {
      setInvoiceEmailError("From address is required.");
      return;
    }
    if (!toList.length) {
      setInvoiceEmailError("Provide at least one recipient email.");
      return;
    }
    if (!invoiceEmailFormData.Content) {
      setInvoiceEmailError("Email content cannot be empty.");
      return;
    }
    setInvoiceEmailError(null);
    setInvoiceEmailSending(true);
    try {
      const creator = await ensureZohoReady();
      const createHandler = resolveAddRecordHandler(creator);
      if (!createHandler) {
        throw new Error(
          "Zoho add API is not available for invoice email logging."
        );
      }
      const ccList = parseEmailList(invoiceEmailFormData.CC);
      const subject =
        invoiceEmailFormData.Subject || "Invoice Details";
      const appName = getAppLinkName() || "knowbal-one";
      const ccRows = ccList.map((email) => ({ Email: email }));
      const emailRecordPayload = {
        // Payment_Request:
        //   invoiceEmailFormData.Request_ID ||
        //   invoiceEmailFormData.Invoice_ID ||
        //   "",
        Assigned_User: invoiceEmailFormData.Assigned_User || "",
        Client_Name: invoiceEmailFormData.Client_Name || "",
        From: invoiceEmailFormData.From,
        To: invoiceEmailFormData.To,
        CC: ccRows,
        Subject_field: subject,
        Content: invoiceEmailFormData.Content,
        Client: clientId || "",
        Invoice_Check: true
      };
      const createResponse = await createHandler({
        app_name: appName,
        appName,
        form_name: SEND_EMAIL_FORM_NAME,
        formName: SEND_EMAIL_FORM_NAME,
        report_name: SEND_EMAIL_FORM_NAME,
        reportName: SEND_EMAIL_FORM_NAME,
        data: emailRecordPayload,
        payload: { data: emailRecordPayload },
      });
      const createErrorMessage = getZohoResponseErrorMessage(createResponse);
      if (createErrorMessage) {
        const codeLabel =
          createResponse?.code !== undefined ? ` (code ${createResponse.code})` : "";
        setInvoiceEmailError(
          `Unable to send invoice email${codeLabel}: ${createErrorMessage}`
        );
        return;
      }
      const sendMailHandler =
        window.ZOHO?.CREATOR?.UTIL?.sendMail ||
        creator?.UTIL?.sendMail ||
        creator?.sendMail ||
        window.ZOHO?.CREATOR?.API?.sendMail ||
        creator?.API?.sendMail ||
        resolveSendMailHandler(creator);
      if (typeof sendMailHandler === "function") {
        const sendResponse = await sendMailHandler({
          from_mail_id: invoiceEmailFormData.From,
          fromAddress: invoiceEmailFormData.From,
          to_mail_ids: toList,
          toAddress: toList.join(","),
          cc_mail_ids: ccList,
          ccAddress: ccList.join(","),
          subject,
          message: invoiceEmailFormData.Content,
          content: invoiceEmailFormData.Content,
        });
        const sendErrorMessage = getZohoResponseErrorMessage(sendResponse);
        if (sendErrorMessage) {
          const codeLabel =
            sendResponse?.code !== undefined ? ` (code ${sendResponse.code})` : "";
          setInvoiceEmailError(
            `Unable to send invoice email${codeLabel}: ${sendErrorMessage}`
          );
          return;
        }
      } else {
        console.warn(
          "Zoho send mail API is unavailable; proceeding with saved invoice email record."
        );
      }
      closeInvoiceEmailModal();
    } catch (err) {
      setInvoiceEmailError(err?.message || "Unable to send invoice email.");
    } finally {
      setInvoiceEmailSending(false);
    }
  };

  const createInvoiceLineItems = async ({
    addRecordHandler,
    appName,
    invoiceId,
    Invoice_Line_Items,
  }) => {
    const validItems = (Invoice_Line_Items || []).filter(
      (item) => item && (item.Service_Id || item.Service)
    );
    if (!validItems.length) {
      return;
    }
    for (const item of validItems) {
      const payload = buildLineItemPayload(item, invoiceId);
      const requestConfig = {
        app_name: appName,
        appName,
        form_name: INVOICE_LINE_FORM_NAME,
        formName: INVOICE_LINE_FORM_NAME,
        report_name: INVOICE_LINE_FORM_NAME,
        reportName: INVOICE_LINE_FORM_NAME,
        data: payload,
        payload: { data: payload },
      };
      const response = await addRecordHandler(requestConfig);
      if (response?.code && response.code !== 3000) {
        const message =
          response?.data?.message ||
          response?.message ||
          "Unable to create invoice line item.";
        throw new Error(message);
      }
    }
  };

  const deleteInvoiceLineItems = async ({
    dataModule,
    deleteHandler,
    appName,
    invoiceId,
  }) => {
    if (!deleteHandler || !dataModule?.getRecords) {
      return;
    }
    const criteria = buildCriteria("Invoice", invoiceId);
    const response = await dataModule.getRecords({
      report_name: INVOICE_LINE_FORM_NAME,
      criteria,
      page: 1,
      per_page: 200,
    });
    const existingItems = response?.data ?? [];
    const deletions = existingItems
      .filter((item) => item?.ID)
      .map((item) =>
        deleteHandler({
          app_name: appName,
          appName,
          form_name: INVOICE_LINE_FORM_NAME,
          formName: INVOICE_LINE_FORM_NAME,
          report_name: INVOICE_LINE_FORM_NAME,
          reportName: INVOICE_LINE_FORM_NAME,
          id: item.ID,
        })
      );
    await Promise.allSettled(deletions);
  };

  const syncInvoiceLineItems = async ({
    dataModule,
    addRecordHandler,
    updateHandler,
    deleteHandler,
    appName,
    invoiceId,
    Invoice_Line_Items,
  }) => {
    if (!invoiceId || !dataModule?.getRecords) {
      return;
    }
    const response = await dataModule.getRecords({
      report_name: INVOICE_LINE_REPORT_NAME,
      criteria: buildCriteria("Invoice", invoiceId),
      page: 1,
      per_page: 200,
    });
    const existingItems = response?.data ?? [];
    const existingIds = new Map();
    existingItems.forEach((item) => {
      if (item?.ID !== undefined && item?.ID !== null) {
        existingIds.set(String(item.ID), item);
      }
    });
    const normalizedItems = (Invoice_Line_Items || []).map((item) => ({
      ...item,
      ID:
        item.ID ||
        item.Invoice_Line_Item_ID ||
        item.Line_Item_ID ||
        item.line_item_id ||
        null,
    }));
    const desiredIds = new Set(
      normalizedItems.filter((item) => item.ID).map((item) => String(item.ID))
    );
    if (deleteHandler) {
      const deletions = existingItems
        .filter((item) => item?.ID && !desiredIds.has(String(item.ID)))
        .map((item) =>
          deleteHandler({
            app_name: appName,
            appName,
            form_name: INVOICE_LINE_FORM_NAME,
            formName: INVOICE_LINE_FORM_NAME,
            report_name: INVOICE_LINE_REPORT_NAME,
            reportName: INVOICE_LINE_REPORT_NAME,
            id: item.ID,
          })
        );
      await Promise.allSettled(deletions);
    }
    if (!updateHandler) {
      throw new Error("Unable to locate Invoice Line update handler.");
    }
    const updatePromises = normalizedItems
      .filter((item) => item.ID && existingIds.has(String(item.ID)))
      .map((item) => {
        const payload = buildLineItemPayload(item, invoiceId);
        return updateHandler({
          app_name: appName,
          appName,
          form_name: INVOICE_LINE_FORM_NAME,
          formName: INVOICE_LINE_FORM_NAME,
          report_name: INVOICE_LINE_REPORT_NAME,
          reportName: INVOICE_LINE_REPORT_NAME,
          id: item.ID,
          data: payload,
          payload: { data: payload },
        });
      });
    await Promise.allSettled(updatePromises);
    const itemsToCreate = normalizedItems.filter(
      (item) => !item.ID && (item.Service_Id || item.Service)
    );
    if (itemsToCreate.length) {
      await createInvoiceLineItems({
        addRecordHandler,
        appName,
        invoiceId,
        Invoice_Line_Items: itemsToCreate,
      });
    }
  };

  const handleCreateInvoiceSave = async (newInvoice) => {
    try {
      const creator = await ensureZohoReady();
      const addRecord = resolveAddRecordHandler(creator);
      if (!addRecord) {
        throw new Error("Unable to locate Add Invoice API handler.");
      }
      const payload = buildInvoiceFormPayload(newInvoice);
      const appName = getAppLinkName() || "knowbal-one";
      const requestConfig = {
        app_name: appName,
        appName,
        form_name: INVOICE_FORM_NAME,
        formName: INVOICE_FORM_NAME,
        report_name: INVOICE_REPORT_NAME,
        reportName: INVOICE_REPORT_NAME,
        data: payload,
        payload: { data: payload },
      };
      const response = await addRecord(requestConfig);
      if (response?.code && response.code !== 3000) {
        const message =
          response?.data?.message ||
          response?.message ||
          "Zoho Creator rejected the invoice payload.";
        throw new Error(message);
      }
      const invoiceId = response?.data?.ID || response?.data?.id;
      if (!invoiceId) {
        throw new Error("Invoice created but record ID is missing.");
      }
      await createInvoiceLineItems({
        addRecordHandler: addRecord,
        appName,
        invoiceId,
        Invoice_Line_Items: newInvoice.Line_Items,
      });
      await fetchInvoicesData();
      setCreateModalOpen(false);
    } catch (creationError) {
      const message =
        creationError?.message ;
      console.error("Invoice creation failed", creationError);
      throw new Error(message);
    }
  };

  const handleUpdateInvoice = async (updatedInvoice) => {
    if (!updatedInvoice?.ID) {
      throw new Error("Invoice ID is missing.");
    }
    try {
      const creator = await ensureZohoReady();
      const updateHandler = resolveUpdateRecordHandler(creator);
      const deleteHandler = resolveDeleteRecordHandler(creator);
      const addRecordHandler = resolveAddRecordHandler(creator);
      const dataModule = getCreatorModule(creator, "DATA");
      if (!updateHandler) {
        throw new Error("Unable to locate Update Invoice API handler.");
      }
      if (!addRecordHandler) {
        throw new Error("Unable to locate Invoice Line add handler.");
      }
      const payload = buildInvoiceFormPayload(updatedInvoice);
      const appName = getAppLinkName() || "knowbal-one";
      const requestConfig = {
        app_name: appName,
        appName,
        form_name: INVOICE_FORM_NAME,
        formName: INVOICE_FORM_NAME,
        report_name: INVOICE_REPORT_NAME,
        reportName: INVOICE_REPORT_NAME,
        id: updatedInvoice.ID,
        data: payload,
        payload: { data: payload },
      };
      const response = await updateHandler(requestConfig);
  
      
      if (response?.code && response.code !== 3000) {
        const message =
          parseZohoErrorMessage(response) ||
          response?.data?.message ||
          response?.message ||
          "Zoho Creator rejected the invoice update.";
        throw new Error(message);
      }
      try {
        await syncInvoiceLineItems({
          dataModule,
          addRecordHandler,
          updateHandler,
          deleteHandler,
          appName,
          invoiceId: updatedInvoice.ID,
          Invoice_Line_Items: updatedInvoice.Line_Items,
        });
      } catch (lineSyncError) {
        console.warn(
          "Line item sync failed, falling back to delete + recreate",
          lineSyncError
        );
        await deleteInvoiceLineItems({
          dataModule,
          deleteHandler,
          appName,
          invoiceId: updatedInvoice.ID,
        });
        await createInvoiceLineItems({
          addRecordHandler,
          appName,
          invoiceId: updatedInvoice.ID,
          Invoice_Line_Items: updatedInvoice.Line_Items,
        });
      }
      await fetchInvoicesData();
      setCreateModalOpen(false);
      setEditingInvoice(null);
      setEditorMode("create");
    } catch (err) {
      console.error("Invoice update failed", err);
      const message =
        parseZohoErrorMessage(err) ||
        err?.message ||
        "Unable to update invoice.";
      throw new Error(message);
    }
  };

  const loadInvoiceForEdit = async (invoiceRecord) => {
    if (!invoiceRecord) return;
    const invoiceId = invoiceRecord.ID;
    const invoiceNumber = invoiceRecord.Invoice_Number;
    if (!invoiceId && !invoiceNumber) {
      return;
    }
    setEditorMode("edit");
    setEditingInvoice(null);
    setInvoiceEditorError(null);
    setCreateModalOpen(true);
    setInvoiceEditorLoading(true);
    try {
      const creator = await ensureZohoReady();
      const dataModule = getCreatorModule(creator, "DATA");
      if (!dataModule?.getRecords) {
        throw new Error("Zoho DATA.getRecords API unavailable.");
      }
      const appName = getAppLinkName() || "knowbal-one";
      const getRecordById = resolveGetRecordByIdHandler(creator);
      let record = null;
      if (invoiceId && getRecordById) {
        try {
          const recordResponse = await getRecordById({
            app_name: appName,
            appName,
            form_name: INVOICE_FORM_NAME,
            formName: INVOICE_FORM_NAME,
            report_name: INVOICE_REPORT_NAME,
            reportName: INVOICE_REPORT_NAME,
            id: invoiceId,
          });
          record = normalizeZohoRecordResponse(recordResponse);
        } catch (byIdError) {
          console.warn("Unable to fetch invoice via getRecordById", byIdError);
        }
      }
      if (!record) {
        const criteriaField = invoiceId ? "ID" : "Invoice_Number";
        const criteriaValue = invoiceId || invoiceNumber;
        const baseCriteria = buildCriteria(criteriaField, criteriaValue);
        let response = null;
        if (normalizedClientId) {
          const clientCriteriaCandidates = buildClientCriteriaList(
            normalizedClientId
          );
          let lastCriteriaError = null;
          for (const clientCriteria of clientCriteriaCandidates) {
            const combinedCriteria = combineCriteria(
              clientCriteria,
              baseCriteria
            );
            try {
              response = await dataModule.getRecords({
                report_name: INVOICE_REPORT_NAME,
                criteria: combinedCriteria || baseCriteria,
                page: 1,
                per_page: 1,
              });
              break;
            } catch (criteriaError) {
              if (isCriteriaError(criteriaError)) {
                lastCriteriaError = criteriaError;
                continue;
              }
              throw criteriaError;
            }
          }
          if (!response && lastCriteriaError) {
            throw lastCriteriaError;
          }
        }
        if (!response) {
          response = await dataModule.getRecords({
            report_name: INVOICE_REPORT_NAME,
            criteria: baseCriteria,
            page: 1,
            per_page: 1,
          });
        }
        record = normalizeZohoRecordResponse(response);
      }
      record = record || invoiceRecord;
      if (!record) {
        throw new Error("Invoice not found.");
      }
      const resolvedInvoiceId = record.ID || invoiceId || invoiceNumber;
      let Invoice_Line_Items = [];
      if (resolvedInvoiceId) {
        try {
          const latestLineItemsResponse = await dataModule.getRecords({
            report_name: INVOICE_LINE_REPORT_NAME,
            criteria: buildCriteria("Invoice", resolvedInvoiceId),
            page: 1,
            per_page: 200,
          });
          Invoice_Line_Items = latestLineItemsResponse?.data ?? [];
        } catch (lineError) {
          console.warn("Unable to fetch invoice line items", lineError);
        }
      }
      if (!Invoice_Line_Items.length) {
        if (Array.isArray(record.Line_Items) && record.Line_Items.length) {
          Invoice_Line_Items = [...record.Line_Items];
        } else if (
          Array.isArray(record.Invoice_Line_Items) &&
          record.Invoice_Line_Items.length
        ) {
          Invoice_Line_Items = [...record.Invoice_Line_Items];
        }
      }
      if (!Invoice_Line_Items.length) {
        Invoice_Line_Items = getLineItemsForInvoice(
          invoiceLineItemsLookup,
          record
        );
      }
      if (!Invoice_Line_Items.length) {
        let allLineItems = invoiceLineItemsCache;
        if (!allLineItems.length) {
          try {
            allLineItems = await fetchAllRecordsForReport({
              dataModule,
              report_name: INVOICE_LINE_REPORT_NAME,
            });
            setInvoiceLineItemsCache(allLineItems);
          } catch (lineItemError) {
            console.warn("Unable to fetch invoice line items", lineItemError);
            allLineItems = [];
          }
        }
        const refreshedLookup = buildLineItemsLookup(allLineItems);
        Invoice_Line_Items = getLineItemsForInvoice(refreshedLookup, record);
      }
      let paymentUtilizations = [];
      if (resolvedInvoiceId) {
        try {
          paymentUtilizations = await fetchPaymentUtilizations(record, {
            forceRefresh: true,
          });
        } catch (utilError) {
          console.warn("Unable to fetch payment utilizations", utilError);
        }
      }
      const enrichedLineItems =
        enrichLineItemsWithServiceDetails(Invoice_Line_Items);
      setEditingInvoice({
        ...record,
        Line_Items: enrichedLineItems,
        Payment_Utilizations: paymentUtilizations,
      });
    } catch (err) {
      setInvoiceEditorError(err.message || "Unable to load invoice.");
    } finally {
      setInvoiceEditorLoading(false);
    }
  };

  const clearUtilizationsView = useCallback(() => {
    setSelectedUtilizationInvoice(null);
    setSelectedUtilizations([]);
    setUtilizationError(null);
    setIsUtilizationLoading(false);
  }, []);

  const handleViewUtilizations = useCallback(
    async (invoiceRecord, { forceRefresh = false } = {}) => {
      if (!invoiceRecord) {
        return;
      }
      const currentInvoiceId =
        selectedUtilizationInvoice?.ID || selectedUtilizationInvoice?.Invoice;
      const nextInvoiceId = invoiceRecord?.ID || invoiceRecord?.Invoice;
      const isSameInvoice =
        currentInvoiceId !== undefined &&
        currentInvoiceId !== null &&
        nextInvoiceId !== undefined &&
        nextInvoiceId !== null &&
        String(currentInvoiceId) === String(nextInvoiceId);
      if (isSameInvoice && !forceRefresh) {
        clearUtilizationsView();
        return;
      }
      setSelectedUtilizationInvoice(invoiceRecord);
      setSelectedUtilizations([]);
      setUtilizationError(null);
      setIsUtilizationLoading(true);
      try {
        const utilizations = await fetchPaymentUtilizations(invoiceRecord, {
          forceRefresh,
        });
        setSelectedUtilizations(utilizations);
      } catch (err) {
        console.warn("Unable to fetch payment utilizations", err);
        setSelectedUtilizations([]);
        setUtilizationError(null);
      } finally {
        setIsUtilizationLoading(false);
      }
    },
    [
      clearUtilizationsView,
      fetchPaymentUtilizations,
      selectedUtilizationInvoice,
    ]
  );

  const refreshUtilizations = useCallback(() => {
    if (selectedUtilizationInvoice) {
      handleViewUtilizations(selectedUtilizationInvoice, { forceRefresh: true });
    }
  }, [handleViewUtilizations, selectedUtilizationInvoice]);

  const handleUtilizationFieldChange = useCallback(
    (field, value) => {
      setUtilizationFormData((prev) => {
        const base =
          prev || createUtilizationFormData(utilizationModalInvoice);
        const next = {
          ...base,
          [field]: value,
        };
        if (field === "Payment_Received") {
          const selectedOption = paymentReceiptOptions.find(
            (option) => String(option.value) === String(value)
          );
          if (
            selectedOption &&
            selectedOption.amount !== undefined &&
            selectedOption.amount !== null
          ) {
            const normalizedAmount = Number(selectedOption.amount);
            next.Received_Amount = normalizedAmount;
            // next.Total_Received_Amount = Number.isFinite(normalizedAmount)
            //   ? normalizedAmount
            //   : "";
          }
        }
        return next;
      });
    },
    [paymentReceiptOptions, utilizationModalInvoice]
  );

  const handleUtilizationFileChange = useCallback(
    (file) => {
      setUtilizationUploadFile(file || null);
      setUtilizationFormData((prev) => ({
        ...(prev || createUtilizationFormData(utilizationModalInvoice)),
        Upload_File: file ? file.name : "",
      }));
    },
    [utilizationModalInvoice]
  );

  const handleOpenUtilizationModal = useCallback(
    async (invoiceRecord) => {
      if (!invoiceRecord) {
        return;
      }
      setUtilizationModalInvoice(invoiceRecord);
      setUtilizationFormData(createUtilizationFormData(invoiceRecord));
      setUtilizationModalError(null);
      setPaymentReceiptOptions([]);
      setUtilizationModalOpen(true);
      setPaymentReceiptsLoading(true);
      setUtilizationUploadFile(null);
      try {
        const receipts = await fetchAllPaymentReceipts();
        const normalizedReceipts = receipts
          .filter(
            (receipt) =>
              resolveBooleanFlag(receipt?.Reconciliation1) &&
              Number(receipt?.Un_Utilised_Amount) >= 1
          )
          .map((receipt, index) => {
          const optionId = receipt?.ID || receipt?.id || `receipt-${index}`;
          const label =
            receipt?.Receive_ID ||
            receipt?.Payment_Receipt_ID ||
            receipt?.Receipt_Number ||
            receipt?.Reference_Number ;
          const amountCandidate =
            receipt?.Un_Utilised_Amount 
           
        
          const amount = amountCandidate === "" ? "" : Number(amountCandidate);
          return {
            value: optionId,
            label,
            amount: Number.isFinite(amount) ? amount : "",
            Reconciliation1:receipt.Reconciliation1
          };
        });
        setPaymentReceiptOptions(normalizedReceipts);
      } catch (err) {
        setUtilizationModalError(
          err?.message || "Unable to load payment receipts."
        );
      } finally {
        setPaymentReceiptsLoading(false);
      }
      try {
        const utilizationRecords = await fetchPaymentUtilizations(
          invoiceRecord,
          { forceRefresh: true }
        );
        const totalUtilized = computeUtilizedAmount(utilizationRecords);
        setUtilizationFormData((prev) => ({
          ...(prev || createUtilizationFormData(invoiceRecord)),
          Total_Utilized_Amount: Number.isFinite(totalUtilized)
            ? totalUtilized.toFixed(2)
            : "",
        }));
      } catch (err) {
        console.warn("Unable to compute utilization total", err);
      }
    },
    [fetchAllPaymentReceipts, fetchPaymentUtilizations]
  );

  const handleCloseUtilizationModal = useCallback(() => {
    setUtilizationModalOpen(false);
    setUtilizationModalInvoice(null);
    setUtilizationFormData(null);
    setUtilizationModalError(null);
    setPaymentReceiptOptions([]);
    setPaymentReceiptsLoading(false);
    setUtilizationUploadFile(null);
  }, []);

  const handleUtilizationSubmit = useCallback(async () => {
    if (!utilizationFormData) {
      return;
    }
    const missing = [];
    if (!utilizationFormData.Payment_Received) {
      missing.push("Payment Received");
    }
    if (!utilizationFormData.Utilization_Agent) {
      missing.push("Utilization Agent");
    }
    if (!utilizationFormData.Utilization) {
      missing.push("Utilization Amount");
    }
    if (missing.length) {
      setUtilizationModalError(
        `Please provide: ${missing.join(", ")} before submitting.`
      );
      return;
    }
    const parsedUtilization = Number(utilizationFormData.Utilization);
    const parsedTotalReceived =
      Number(utilizationFormData.Total_Received_Amount) ||
      Number(utilizationFormData.Received_Amount);
    if (
      Number.isFinite(parsedUtilization) &&
      Number.isFinite(parsedTotalReceived) &&
      parsedTotalReceived > 0 &&
      parsedUtilization > parsedTotalReceived
    ) {
      setUtilizationModalError(
        "Utilization amount cannot exceed the selected receipt's total received amount."
      );
      return;
    }
    const invoiceTotalAmount =
      Number(utilizationModalInvoice?.Total_Amount) ||
      Number(utilizationModalInvoice?.Invoice_Total) ||
      Number(utilizationModalInvoice?.Total) ||
      0;
    const previouslyUtilized =
      Number(utilizationFormData.Total_Utilized_Amount) || 0;
    if (
      Number.isFinite(invoiceTotalAmount) &&
      invoiceTotalAmount > 0 &&
      Number.isFinite(previouslyUtilized)
    ) {
      const projectedUtilization = previouslyUtilized + parsedUtilization;
      if (projectedUtilization > invoiceTotalAmount) {
        const message =
          "You can't use more than invoice amount";
        setUtilizationModalError(message);
        return;
      }
    }
    setUtilizationModalError(null);
    setUtilizationSaving(true);
    try {
      const creator = await ensureZohoReady();
      const addRecord = resolveAddRecordHandler(creator);
      if (!addRecord) {
        throw new Error("Unable to locate Payment Utilization API handler.");
      }
      const payload = {
        Client: clientId || "",
        Invoice_Number: utilizationFormData.Invoice_Number_Id || "",
        Invoice: utilizationFormData.Invoice_Number_Id || "",
        Payment_Received: utilizationFormData.Payment_Received || "",
        Utilization_Agent: utilizationFormData.Utilization_Agent || "",
        Agent: utilizationFormData.Utilization_Agent || "",
        Received_Amount:
          Number(utilizationFormData.Received_Amount) || 0,
        Utilization: Number(utilizationFormData.Utilization) || 0,
        Utilized_Amount: Number(utilizationFormData.Utilized_Amount) || 0,
        Total_Utilized_Amount:
          Number(utilizationFormData.Total_Utilized_Amount) || 0,
        Receipt_Date: formatDateForZoho(
          utilizationFormData.Receipt_Date
        ),
        Utilization_Note: utilizationFormData.Utilization_Note || "",
      };
      const appName = getAppLinkName() || "knowbal-one";
      const requestConfig = {
        app_name: appName,
        appName,
        form_name: PAYMENT_UTILIZATION_FORM_NAME,
        formName: PAYMENT_UTILIZATION_FORM_NAME,
        report_name: PAYMENT_UTILIZATION_REPORT_NAME,
        reportName: PAYMENT_UTILIZATION_REPORT_NAME,
        data: payload,
        payload: { data: payload },
      };
      const response = await addRecord(requestConfig);
      if (response?.code && response.code !== 3000) {
        const message =
          response?.data?.message ||
          response?.message ||
          "Unable to save payment utilization.";
        throw new Error(message);
      }
      const newRecordId = response?.data?.ID || response?.data?.id;
      if (newRecordId && utilizationUploadFile) {
        try {
          await uploadUtilizationAttachment({
            recordId: newRecordId,
            file: utilizationUploadFile,
          });
        } catch (uploadError) {
          console.warn("Unable to upload utilization attachment", uploadError);
        }
      }
      if (utilizationModalInvoice) {
        handleViewUtilizations(utilizationModalInvoice, { forceRefresh: true });
      }
      handleCloseUtilizationModal();
    } catch (err) {
      const message = parseZohoErrorMessage(err);
      setUtilizationModalError(
        message || "Unable to save payment utilization."
      );
      console.error("Utilization save failed", err);
    } finally {
      setUtilizationSaving(false);
    }
  }, [
    ensureZohoReady,
    clientId,
    handleCloseUtilizationModal,
    handleViewUtilizations,
    utilizationFormData,
    utilizationModalInvoice,
    utilizationUploadFile,
    uploadUtilizationAttachment,
  ]);

  const handleInvoiceRowClick = (invoice) => {
    if (!invoice) return;
    loadInvoiceForEdit(invoice);
  };

  return (
    <div className="container pb-5">
      <InvoiceHeader />
      <InvoiceListCard
        filteredInvoices={filteredInvoices}
        isLoading={isLoading}
        error={error}
        formatCurrency={formatCurrency}
        onAddInvoice={() => {
          setEditorMode("create");
          setEditingInvoice(null);
          setInvoiceEditorError(null);
          setCreateModalOpen(true);
        }}
        onUpdateInvoice={handleInvoiceRowClick}
        onViewUtilizations={handleViewUtilizations}
        isUtilizationLoading={isUtilizationLoading}
        selectedUtilizationInvoice={selectedUtilizationInvoice}
        selectedUtilizations={selectedUtilizations}
        utilizationError={utilizationError}
        onRefreshUtilizations={refreshUtilizations}
        onClearUtilizations={clearUtilizationsView}
        onUtilizeInvoice={handleOpenUtilizationModal}
        onSendInvoice={openInvoiceEmailModal}
      />
      <InvoiceCreateModal
        isOpen={isCreateModalOpen}
        mode={editorMode}
        initialData={editorMode === "edit" ? editingInvoice : null}
        isLoading={editorMode === "edit" && (isInvoiceEditorLoading && !editingInvoice)}
        loadError={editorMode === "edit" ? invoiceEditorError : null}
        onClose={() => {
          setCreateModalOpen(false);
          setEditingInvoice(null);
          setEditorMode("create");
          setInvoiceEditorError(null);
          setInvoiceEditorLoading(false);
        }}
        onSave={handleCreateInvoiceSave}
        onUpdate={handleUpdateInvoice}
        agentOptions={agentOptions}
        serviceOptions={serviceOptions}
        formatCurrency={formatCurrency}
        clientDetails={clientDetails}
        serviceDetails={serviceDetails}
      />
      <PaymentUtilizationModal
        isOpen={isUtilizationModalOpen}
        invoice={utilizationModalInvoice}
        formData={utilizationFormData}
        agentOptions={agentOptions}
        paymentReceiptOptions={paymentReceiptOptions}
        isReceiptLoading={isPaymentReceiptsLoading}
        isSaving={isUtilizationSaving}
        error={utilizationModalError}
        onFieldChange={handleUtilizationFieldChange}
        uploadFile={utilizationUploadFile}
        onFileChange={handleUtilizationFileChange}
        onClose={handleCloseUtilizationModal}
        onSave={handleUtilizationSubmit}
      />
      <Suspense fallback={null}>
        <PaymentRequestEmailModal
          isOpen={isEmailModalOpen}
          formData={invoiceEmailFormData || {}}
          agentOptions={agentOptions}
          emailTemplates={invoiceEmailTemplates}
          placeholderValues={invoiceEmailPlaceholderValues || {}}
          onChange={handleInvoiceEmailFieldChange}
          onClose={closeInvoiceEmailModal}
          onSend={handleSendInvoiceEmail}
          isSending={isInvoiceEmailSending}
          error={invoiceEmailError}
        />
      </Suspense>
    </div>
  );
}

export default Invoices;
