import React, {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import PaymentRequestsSection from "./components/PaymentRequestsSection";
import PaymentRequestModal from "./components/PaymentRequestModal";
import CreatePaymentRequestModal from "./components/CreatePaymentRequestModal";
import PaymentReceiptModal from "./components/PaymentReceiptModal";
import {
  formatDateForZoho,
  getInitialCreateFormData,
  normalizeDisplayValue,
  normalizeRecordId,
  sumReceiptAmounts,
} from "./utils/recordUtils";

const PaymentRequestEmailModal = React.lazy(() =>
  import("./components/PaymentRequestEmailModal")
);

const STRIPE_INTEGRATION_REPORT_NAME = "All_Stripe_Integrations";
const STRIPE_LINK_PLACEHOLDER =
  "https://crm.kondesk.com/KondeskPG/Index?q=fAdkzx-kXgwRRACU3_rST5ajJeNTxvjLDSXNFKF6DIk1JeEdXFh1XZbht8Rdloss";
const STRIPE_CTA_TEXT = "Click here to pay by card";
const CREATOR_DEFAULT_ORIGIN = "https://creatorapp.zoho.com.au";
const CLIENT_CRITERIA_FIELDS = ["Client", "Client_ID", "Clientid"];
const RECEIPT_CLIENT_FIELDS = ["Client_ID", "Clientid"];

const buildEqualityCriteria = (fieldName, value, options = {}) => {
  if (!fieldName || value === undefined || value === null || value === "") {
    return "";
  }
  const raw = String(value).trim();
  const numericPattern = /^-?\d+$/;
  const isNumeric = numericPattern.test(raw);
  const treatAsString =
    typeof options.treatAsString === "boolean" ? options.treatAsString : !isNumeric;
  const safeValue = treatAsString
    ? `"${raw.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`
    : raw;
  return `(${fieldName} == ${safeValue})`;
};

const buildClientCriteriaList = (value, fields = CLIENT_CRITERIA_FIELDS) => {
  if (value === undefined || value === null || value === "") {
    return [];
  }
  return fields
    .map((field) => buildEqualityCriteria(field, value))
    .filter(Boolean);
};

const isNoRecordsError = (error) => {
  if (!error) {
    return false;
  }
  const codeCandidates = [
    error?.code,
    error?.data?.code,
    error?.response?.code,
    error?.response?.data?.code,
  ];
  if (codeCandidates.some((code) => Number(code) === 9280)) {
    return true;
  }
  const messageCandidates = [
    error?.message,
    error?.data?.message,
    error?.response?.data?.message,
    error?.description,
    error?.data?.description,
  ];
  if (
    messageCandidates.some((message) =>
      message?.toString().toLowerCase().includes("no records found")
    )
  ) {
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
    message.includes("left expression is of type") ||
    message.includes("variable") ||
    message.includes("column")
  );
};

const ensureAbsoluteUrl = (url) => {
  if (!url) {
    return "";
  }
  if (/^https?:\/\//i.test(url) || /^data:/i.test(url)) {
    return url;
  }
  if (url.startsWith("//")) {
    return `${window?.location?.protocol || "https:"}${url}`;
  }
  const origin =
    window?.ZOHO?.CREATOR?.config?.creatorOrigin ||
    window?.ZOHO?.CREATOR?.config?.apporigin ||
    CREATOR_DEFAULT_ORIGIN;
  if (url.startsWith("/")) {
    return `${origin}${url}`;
  }
  return `${origin}/${url}`;
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const isRateLimitError = (error) => {
  if (!error) return false;
  const code =
    error?.code ||
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

const resolveUploadFileHandler = (creatorObj) => {
  const methodNames = ["uploadFile", "upload_file", "uploadFiles"];
  const modulesToCheck = [
    creatorObj,
    creatorObj?.FILE,
    creatorObj?.API,
    creatorObj?.DATA,
    creatorObj?.CREATOR,
    creatorObj?.CREATOR?.API,
    creatorObj?.CREATOR?.DATA,
    creatorObj?.CREATOR?.FILE,
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

function Acconts({ clientId, serviceId, clientDetails, serviceDetails }) {
  const [paymentRequests, setPaymentRequests] = useState([]);
  const [paymentReceipts, setPaymentReceipts] = useState([]);
  const [paymentReceiptsLoaded, setPaymentReceiptsLoaded] = useState(false);
  const zohoInitPromiseRef = useRef(null);
  const zohoSdkPromiseRef = useRef(null);
  const paymentRequestFetchStateRef = useRef({
    clientId: null,
    loading: false,
    loaded: false,
  });
  const [isRequestFormOpen, setRequestFormOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [requestFormData, setRequestFormData] = useState(null);
  const [isRequestLoading, setIsRequestLoading] = useState(false);
  const [requestError, setRequestError] = useState(null);
  const [isRequestSaving, setIsRequestSaving] = useState(false);
  const [requestSaveStatus, setRequestSaveStatus] = useState(null);
  const [isCreateFormOpen, setCreateFormOpen] = useState(false);
  const [createFormData, setCreateFormData] = useState(getInitialCreateFormData());
  const [createError, setCreateError] = useState(null);
  const [isCreateSaving, setIsCreateSaving] = useState(false);
  const [createSaveStatus, setCreateSaveStatus] = useState(null);
  const [expandedRequestId, setExpandedRequestId] = useState(null);
  const [isReceiptFormOpen, setReceiptFormOpen] = useState(false);
  const [receiptFormData, setReceiptFormData] = useState(null);
  const [receiptError, setReceiptError] = useState(null);
  const [isReceiptSaving, setIsReceiptSaving] = useState(false);
  const [receiptSaveStatus, setReceiptSaveStatus] = useState(null);
  const [activeReceiptRequest, setActiveReceiptRequest] = useState(null);
  const [agentOptions, setAgentOptions] = useState([]);
  const [receiptUploadFile, setReceiptUploadFile] = useState(null);
  const [isEmailModalOpen, setEmailModalOpen] = useState(false);
  const [emailFormData, setEmailFormData] = useState(null);
  const [emailError, setEmailError] = useState(null);
  const [isEmailSending, setEmailSending] = useState(false);
  const [emailTemplates, setEmailTemplates] = useState([]);
  const [emailPlaceholderValues, setEmailPlaceholderValues] = useState(null);
  const stripeUrlCacheRef = useRef(new Map());
  const paymentReceiptsPromiseRef = useRef(null);
  const agentsFetchedRef = useRef(false);
  const normalizedClientId = useMemo(
    () => normalizeRecordId(clientId),
    [clientId]
  );
  useEffect(() => {
    paymentReceiptsPromiseRef.current = null;
    setPaymentReceipts([]);
    setPaymentReceiptsLoaded(false);
  }, [normalizedClientId]);

  console.log("paymentRequests1111" + JSON.stringify(paymentRequests));
  
  const serviceIdRef = useRef(null);
  const clientDetailsRef = useRef(null);
  const serviceDetailsRef = useRef(null);
  useEffect(() => {
    serviceIdRef.current = normalizeRecordId(serviceId);
  }, [serviceId]);
  useEffect(() => {
    clientDetailsRef.current = clientDetails || null;
  }, [clientDetails]);
  useEffect(() => {
    serviceDetailsRef.current = serviceDetails || null;
  }, [serviceDetails]);
  

  const getRequestClientIdentifier = (record) => {
    if (!record) {
      return "";
    }
    const candidates = [
      record.Client_ID,
      record.Client_ID?.ID,
      record.Client_ID?.id,
      record.Client_ID?.Client_ID,
      record.Client_id,
      record.Clientid,
      record.Client?.ID,
      record.Client?.id,
      record.Client?.Client_ID,
      record.Client?.Client_id,
      record.Client_Details?.ID,
      record.Client_Details?.Client_ID,
    ];
    const normalizeCandidate = (candidateValue) => {
      if (candidateValue === undefined || candidateValue === null) {
        return "";
      }
      if (typeof candidateValue === "object") {
        const nestedValues = [
          candidateValue.ID,
          candidateValue.id,
          candidateValue.Client_ID,
          candidateValue.client_id,
          candidateValue.Clientid,
          candidateValue.value,
          candidateValue.lookup_value,
        ];
        for (const nested of nestedValues) {
          const normalizedNested = normalizeRecordId(nested);
          if (normalizedNested) {
            return normalizedNested;
          }
        }
        return "";
      }
      return normalizeRecordId(candidateValue) || "";
    };
    for (const candidate of candidates) {
      const normalized = normalizeCandidate(candidate);
      if (normalized) {
        return normalized;
      }
    }
    return "";
  };

  const getClientDisplayName = (request) => {
    if (!request) return "";
    return (
   request["Client.Name_of_Client1"].first_name||
      ""
    );
  };

  const buildEmailContent = (request) => {
    const clientName = getClientDisplayName(request) || "Client";
    const amount = request?.Requested_Amount
      ? Number(request.Requested_Amount).toLocaleString("en-US", {
          style: "currency",
          currency: "USD",
          minimumFractionDigits: 2,
        })
      : "";
    const requestNumber = request?.Payment_Request_ID
      ? `#${request.Payment_Request_ID}`
      : "your recent request";
    return `Dear ${clientName},

We hope you are doing well. This is a friendly reminder about payment request ${requestNumber}.

Requested Amount: ${amount || "—"}
Request Date: ${request?.Request_Date || "—"}
Status: ${request?.Payment_Status || "Pending"}

If you have any questions or have already completed the payment, please ignore this message.

Thank you,
${request?.Agent?.zc_display_value || request?.Agent?.Name || "Team Knowbal"}`;
  };

  const parseEmailList = (value) => {
    if (!value) return [];
    return value
      .split(/[,;\n]/)
      .map((entry) => entry.trim())
      .filter((entry) => entry.length);
  };



  
  const DEFAULT_APP_LINK_NAME =
    process.env.REACT_APP_ZOHO_APP_LINK_NAME || "knowbal-one";
  const PAYMENT_REQUEST_REPORT_NAME = "Payment_Requests";
  const PAYMENT_REQUEST_FORM_NAME = "Payment_Request";
  const PAYMENT_RECEIPT_REPORT_NAME = "Payments_Received";
  const PAYMENT_RECEIPT_FORM_NAME = "Payment_Received";
  const PAYMENT_RECEIPT_FILE_FIELD = "Attachment";
  const USERS_REPORT_NAME = "All_Users";
  const SEND_EMAIL_FORM_NAME = "Send_Email";

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

  const prepareRequestRecord = useCallback((record) => {
    if (!record) {
      return null;
    }
    const agentSource = record.Agent || record.Agent_ID;
    const normalizedAgent = normalizeAgentRecord(agentSource);
    return {
      ...record,
      Agent: normalizedAgent,
      Agent_ID:
        normalizedAgent?.__optionId ||
        normalizeRecordId(record.Agent_ID) ||
        "",
    };
  }, [normalizeAgentRecord]);

  const getMissingRequestFields = (formData) => {
    const missing = [];
    if (!formData?.Request_Date) {
      missing.push("Request Date");
    }
    if (!formData?.Payment_Status) {
      missing.push("Payment Status");
    }
    const requestedAmountValue = Number(formData?.Requested_Amount);
    if (!Number.isFinite(requestedAmountValue) || requestedAmountValue <= 0) {
      missing.push("Requested Amount");
    }
    const agentId =
      formData?.Agent_ID || getAgentOptionId(formData?.Agent);
    if (!agentId) {
      missing.push("Requested Agent");
    }
    return missing;
  };

  const formatErrorDetail = (value) => {
    if (!value) return "";
    if (typeof value === "string") return value;
    if (Array.isArray(value)) {
      return value
        .map((item) => formatErrorDetail(item))
        .filter(Boolean)
        .join(", ");
    }
    if (typeof value === "object") {
      if (value.message) {
        return value.message;
      }
      const entries = Object.entries(value)
        .map(([key, val]) => {
          const formattedVal = formatErrorDetail(val);
          if (!formattedVal) return "";
          return key ? `${key}: ${formattedVal}` : formattedVal;
        })
        .filter(Boolean);
      if (entries.length) {
        return entries.join("; ");
      }
      try {
        return JSON.stringify(value);
      } catch (err) {
        return String(value);
      }
    }
    return String(value);
  };

  const getZohoResponseError = (response, fallbackMessage) => {
    const candidates = [
      response?.error?.Request_Date,
      response?.error?.Agent,
      response?.error?.Requested_Amount,
      response?.error?.Received_Amount,
      response?.error?.Payment_Request_ID,
      response?.error?.join?.(", "),
      response?.error,
      response?.message,
    ];
    for (const candidate of candidates) {
      const formatted = formatErrorDetail(candidate);
      if (formatted) {
        return formatted;
      }
    }
    return fallbackMessage;
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
      return error.map((item) => formatErrorDetail(item)).filter(Boolean).join(", ");
    }
    return formatErrorDetail(error);
  };

  const getAppLinkName = useCallback(() => {
    const fromEnv =
      window.ZOHO?.CREATOR?.ENV?.appLinkName ||
      window.ZOHO?.CREATOR?.config?.appLinkName ||
      window.ZOHO?.CRITERIA?.appLinkName ||
      window.APP_LINK_NAME ||
      window.appLinkName ||
      null;
    if (fromEnv) {
      return fromEnv;
    }
    if (DEFAULT_APP_LINK_NAME) {
      return DEFAULT_APP_LINK_NAME;
    }
    return null;
  }, [DEFAULT_APP_LINK_NAME]);

  const getReceiptsForRequest = useCallback(
    (request) => {
      if (!request || !paymentReceipts.length) {
        return [];
      }
      const requestRecordId = normalizeRecordId(request.ID);
      const requestDisplayValue = normalizeDisplayValue(
        request.Payment_Request_ID || request.Payment_Request?.zc_display_value
      );

      const matchesRequest = (receipt) => {
        if (!receipt) return false;
        let receiptRecordId = null;
        let receiptDisplayValue = null;

        if (receipt.Payment_Request) {
          if (typeof receipt.Payment_Request === "object") {
            receiptRecordId =
              normalizeRecordId(
                receipt.Payment_Request.ID ?? receipt.Payment_Request.id
              ) || receiptRecordId;
            receiptDisplayValue =
              normalizeDisplayValue(
                receipt.Payment_Request.zc_display_value ??
                  receipt.Payment_Request.display_value ??
                  receipt.Payment_Request.Payment_Request_ID ??
                  receipt.Payment_Request.name
              ) || receiptDisplayValue;
          } else {
            receiptRecordId =
              receiptRecordId ||
              normalizeRecordId(
                receipt.Payment_Request ?? receipt.Payment_Request_ID
              );
          }
        }

        if (
          receipt.Payment_Request_ID &&
          typeof receipt.Payment_Request_ID === "object"
        ) {
          receiptRecordId =
            normalizeRecordId(
              receipt.Payment_Request_ID.ID ?? receipt.Payment_Request_ID.id
            ) || receiptRecordId;
          receiptDisplayValue =
            normalizeDisplayValue(
              receipt.Payment_Request_ID.zc_display_value ??
                receipt.Payment_Request_ID.display_value ??
                receipt.Payment_Request_ID.Payment_Request_ID ??
                receipt.Payment_Request_ID.name
            ) || receiptDisplayValue;
        } else if (receipt.Payment_Request_ID) {
          receiptRecordId =
            receiptRecordId || normalizeRecordId(receipt.Payment_Request_ID);
          receiptDisplayValue =
            receiptDisplayValue ||
            normalizeDisplayValue(receipt.Payment_Request_ID);
        }

        return (
          (requestRecordId &&
            receiptRecordId &&
            receiptRecordId === requestRecordId) ||
          (requestDisplayValue &&
            receiptDisplayValue &&
            receiptDisplayValue === requestDisplayValue)
        );
      };

      return paymentReceipts.filter((receipt) => matchesRequest(receipt));
    },
    [paymentReceipts]
  );

  const relatedPaymentReceipts = useMemo(
    () => getReceiptsForRequest(selectedRequest),
    [selectedRequest, getReceiptsForRequest]
  );

  const relatedPaymentReceiptsTotal = useMemo(
    () => sumReceiptAmounts(relatedPaymentReceipts),
    [relatedPaymentReceipts]
  );

  const expandedRequest = useMemo(
    () =>
      expandedRequestId
        ? paymentRequests.find((req) => req.ID === expandedRequestId) || null
        : null,
    [expandedRequestId, paymentRequests]
  );

  const expandedPaymentReceipts = useMemo(
    () => getReceiptsForRequest(expandedRequest),
    [expandedRequest, getReceiptsForRequest]
  );

  const expandedPaymentReceiptsTotal = useMemo(
    () => sumReceiptAmounts(expandedPaymentReceipts),
    [expandedPaymentReceipts]
  );

  const loadZohoSdk = useCallback(() => {
    if (window.ZOHO?.CREATOR) {
      return Promise.resolve(window.ZOHO.CREATOR);
    }
    if (!zohoSdkPromiseRef.current) {
      zohoSdkPromiseRef.current = new Promise((resolve, reject) => {
        const existingScript = document.querySelector(
          'script[data-sdk="zoho-creator"]'
        );
        if (existingScript) {
          existingScript.addEventListener("load", () =>
            resolve(window.ZOHO?.CREATOR)
          );
          existingScript.addEventListener("error", () =>
            reject(new Error("Failed to load Zoho Creator SDK."))
          );
          return;
        }

        const script = document.createElement("script");
        script.src =
          "https://js.zohostatic.com/creator/widgets/sdk/4.0/js/zoho-creator-sdk.min.js";
        script.async = true;
        script.dataset.sdk = "zoho-creator";
        script.onload = () => resolve(window.ZOHO?.CREATOR);
        script.onerror = () =>
          reject(new Error("Failed to load Zoho Creator SDK."));
        document.head.appendChild(script);
      });
    }
    return zohoSdkPromiseRef.current;
  }, []);

  const ensureZohoReady = useCallback(async () => {
    if (!window.ZOHO?.CREATOR) {
      await loadZohoSdk();
    }
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
  }, [loadZohoSdk]);

  const fetchStripeIntegrationUrl = useCallback(
    async (request) => {
      if (!request) {
        return "";
      }

      const referenceId = normalizeRecordId(request.ID);

      if (!referenceId) {
        return "";
      }

      const creator = await ensureZohoReady();
      const dataModule = getCreatorModule(creator, "DATA");

      let recordUrl = null;
      try {
        const response = await dataModule.getRecords({
          report_name: STRIPE_INTEGRATION_REPORT_NAME,
          criteria: `Payment_Request_ID == ${referenceId}`,
          page: 1,
          per_page: 1,
        });
        recordUrl = response?.data?.[0]?.Url?.url || null;
        console.log("recordUrl1111"+ recordUrl);
        
      } catch (err) {
        console.warn("Unable to locate Stripe integration record", err);
      }

      if (!recordUrl) {
        stripeUrlCacheRef.current.set(referenceId, "");
        return "";
      }
      try {
        // const recordResponse = await dataModule.getRecordById({
        //   report_name: STRIPE_INTEGRATION_REPORT_NAME,
        //   id: recordId,
        // });
        // const record =
        //   recordResponse?.data ||
        //   recordResponse?.record ||
        //   (Array.isArray(recordResponse?.data)
        //     ? recordResponse.data[0]
        //     : null);

        // const resolvedUrl =
        //   record?.Url ||
        //   record?.URL ||
        //   record?.Payment_Url ||
        //   record?.Payment_URL ||
        //   record?.Link ||
        //   "";
        const normalizedUrl = ensureAbsoluteUrl(recordUrl);
        stripeUrlCacheRef.current.set(referenceId, normalizedUrl || "");
        return normalizedUrl || "";
      } catch (err) {
        console.warn("Unable to fetch Stripe integration record by ID", err);
        stripeUrlCacheRef.current.set(referenceId, "");
        return "";
      }
    },
    [ensureZohoReady]
  );

  const loadPaymentReceipts = useCallback(async ({ forceRefresh = false } = {}) => {
    if (!normalizedClientId) {
      setPaymentReceipts([]);
      setPaymentReceiptsLoaded(false);
      return [];
    }
    if (forceRefresh) {
      paymentReceiptsPromiseRef.current = null;
      setPaymentReceiptsLoaded(false);
    }
    if (!forceRefresh && paymentReceiptsLoaded && paymentReceipts.length) {
      return paymentReceipts;
    }
    if (!paymentReceiptsPromiseRef.current) {
      paymentReceiptsPromiseRef.current = (async () => {
        try {
          const creator = await ensureZohoReady();
          const dataModule = getCreatorModule(creator, "DATA");
          if (!dataModule?.getRecords) {
            throw new Error("Zoho DATA.getRecords API unavailable.");
          }
          const criteriaCandidates = buildClientCriteriaList(
            normalizedClientId,
            RECEIPT_CLIENT_FIELDS
          );
          if (!criteriaCandidates.length) {
            setPaymentReceipts([]);
            return [];
          }
          let lastCriteriaError = null;
          for (const criteria of criteriaCandidates) {
            try {
              const response = await dataModule.getRecords({
                report_name: PAYMENT_RECEIPT_REPORT_NAME,
                criteria,
              });
              const records = response?.data || [];
              setPaymentReceipts(records);
              setPaymentReceiptsLoaded(true);
              return records;
            } catch (error) {
              if (isCriteriaError(error)) {
                lastCriteriaError = error;
                continue;
              }
              throw error;
            }
          }
          if (lastCriteriaError) {
            throw lastCriteriaError;
          }
          setPaymentReceipts([]);
          return [];
        } finally {
          paymentReceiptsPromiseRef.current = null;
        }
      })();
    }
    return paymentReceiptsPromiseRef.current;
  }, [
    ensureZohoReady,
    normalizedClientId,
    paymentReceipts,
    paymentReceiptsLoaded,
  ]);


  const loadEmailTemplates = useCallback(async () => {
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
      setEmailTemplates(templates);
      return templates;
    } catch (err) {
      console.warn("Unable to fetch email templates", err);
      setEmailTemplates([]);
      return [];
    }
  }, [ensureZohoReady]);


  const uploadPaymentReceiptAttachment = useCallback(
    async ({ recordId, file }) => {
      if (!recordId || !file) {
        return;
      }
      const creator = await ensureZohoReady();
      const uploadHandler =
        creator?.FILE?.uploadFile ||
        creator?.FILE?.upload_file ||
        creator?.FILE?.uploadFiles ||
        resolveUploadFileHandler(creator);
      if (!uploadHandler) {
        throw new Error("Unable to locate payment receipt file upload handler.");
      }
      const appName = getAppLinkName() || "knowbal-one";
      const requestConfig = {
        app_name: appName,
        report_name: PAYMENT_RECEIPT_REPORT_NAME,
        form_name: PAYMENT_RECEIPT_FORM_NAME,
        id: recordId,
        field_name: PAYMENT_RECEIPT_FILE_FIELD,
        file,
      };
      return uploadHandler(requestConfig);
    },
    [ensureZohoReady, getAppLinkName]
  );

 


  const resolveUpdateHandler = (creatorObj) => {
    const methodNames = [
      "updateRecordById",
      "updateRecord",
      "editRecord",
      "update",
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

  const resolveCreateHandler = (creatorObj) => {
    const methodNames = [
      "addRecord",
      "addRecords",
      "createRecord",
      "insertRecord",
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


  const fetchPaymentRequestDetails = async (requestId) => {
    if (!requestId) {
      return;
    }
    setRequestFormOpen(true);
    setIsRequestLoading(true);
    setRequestError(null);
    try {
      const creator = await ensureZohoReady();
      const dataModule = getCreatorModule(creator, "DATA");
      if (!dataModule?.getRecords) {
        throw new Error("Zoho DATA.getRecords API unavailable.");
      }
    
      
      const response = await dataModule.getRecords({
        report_name: PAYMENT_REQUEST_REPORT_NAME,
        // criteria: `(Payment_Request_ID == "${requestId}")`,
        criteria: `(Client == "${clientId}")`,
        page: 1,
      });
    
      
      const record = response?.data?.[0];
      if (!record) {
        setSelectedRequest(null);
        setRequestFormData(null);
        setRequestError("Payment Request not found.");
        return;
      }
      const preparedRecord = prepareRequestRecord(record);
      setSelectedRequest(preparedRecord);
      setRequestFormData(preparedRecord);
    } catch (error) {
      setSelectedRequest(null);
      setRequestFormData(null);
      setRequestError(error.message || "Unable to fetch request.");
    } finally {
      setIsRequestLoading(false);
    }
  };

  const handleRequestRowClick = (request) => {
    if (!request?.Payment_Request_ID) return;
    fetchPaymentRequestDetails(request.Payment_Request_ID);
  };

  const toggleRequestReceipts = (request) => {
    if (!request?.ID) return;
    setExpandedRequestId((current) => (current === request.ID ? null : request.ID));
  };

  const handleRequestInputChange = (field, value) => {
    setRequestFormData((prev) => {
      if (!prev) {
        return prev;
      }
      if (field === "Agent") {
        const normalizedAgent = normalizeAgentRecord(value);
        return {
          ...prev,
          Agent: normalizedAgent,
          Agent_ID: normalizedAgent?.__optionId || "",
        };
      }
      return {
        ...prev,
        [field]: value,
      };
    });
  };

  const closeRequestForm = () => {
    setRequestFormOpen(false);
    setSelectedRequest(null);
    setRequestFormData(null);
    setRequestError(null);
    setRequestSaveStatus(null);
    setIsRequestLoading(false);
    setIsRequestSaving(false);
  };

  const handleRequestSave = async () => {
    if (!requestFormData?.ID) {
      return;
    }
    const missingFields = getMissingRequestFields(requestFormData);
    if (missingFields.length) {
      setRequestError(
        `Please fill the required fields: ${missingFields.join(", ")}.`
      );
      setRequestSaveStatus("error");
      return;
    }
    setIsRequestSaving(true);
    setRequestSaveStatus(null);
    setRequestError(null);
    try {
      const creator = await ensureZohoReady();
      const updateHandler = resolveUpdateHandler(creator);
      if (!updateHandler) {
        throw new Error("Zoho update API is not available.");
      }
      const appName = getAppLinkName() || "knowbal-one";
      const normalizedRequestDate = formatDateForZoho(
        requestFormData.Request_Date
      );
      const agentId =
        requestFormData.Agent_ID ||
        getAgentOptionId(requestFormData.Agent);
      const data = {
        Request_Date: normalizedRequestDate,
        Requested_Amount: requestFormData.Requested_Amount,
        Received_Amount: requestFormData.Received_Amount,
        Payment_Request_ID: requestFormData.Payment_Request_ID,
        Request_Note: requestFormData.Request_Note,
        Payment_Status: requestFormData.Payment_Status,
        Payee_Location: requestFormData.Payee_Location,
        Client:clientId
      };
      if (agentId) {
        data.Agent = agentId;
      }
      const updateConfig = {
        app_name: appName,
        appName,
        report_name: PAYMENT_REQUEST_REPORT_NAME,
        reportName: PAYMENT_REQUEST_REPORT_NAME,
        form_name: PAYMENT_REQUEST_FORM_NAME,
        formName: PAYMENT_REQUEST_FORM_NAME,
        id: requestFormData.ID,
        data,
        payload: { data },
      };
      const response = await updateHandler(updateConfig);
      if (response?.code !== 3000) {
        const errorMessage = getZohoResponseError(
          response,
          "Unable to update payment request."
        );
        throw new Error(errorMessage);
      }
      setRequestSaveStatus("success");
      const normalizedAgentSelection = normalizeAgentRecord(
        requestFormData.Agent || requestFormData.Agent_ID || agentId
      );
      setPaymentRequests((prev) =>
        prev.map((item) =>
          item.ID === requestFormData.ID
            ? {
                ...item,
                ...requestFormData,
                Request_Date: normalizedRequestDate,
                Agent: normalizedAgentSelection,
                Agent_ID: normalizedAgentSelection?.__optionId || "",
              }
            : item
        )
      );
      setSelectedRequest((prev) =>
        prev && prev.ID === requestFormData.ID
          ? {
              ...prev,
              ...requestFormData,
              Request_Date: normalizedRequestDate,
              Agent: normalizedAgentSelection,
              Agent_ID: normalizedAgentSelection?.__optionId || "",
            }
          : prev
      );
      setRequestFormData((prev) =>
        prev
          ? {
              ...prev,
              Agent: normalizedAgentSelection,
              Agent_ID: normalizedAgentSelection?.__optionId || "",
            }
          : prev
      );
    } catch (error) {
      setRequestError(error.message || "Unable to update request.");
      setRequestSaveStatus("error");
    } finally {
      setIsRequestSaving(false);
    }
  };

  const openCreateForm = () => {
    setCreateFormData(getInitialCreateFormData());
    setCreateError(null);
    setCreateSaveStatus(null);
    setCreateFormOpen(true);
  };

  const closeCreateForm = () => {
    setCreateFormOpen(false);
    setCreateError(null);
    setCreateSaveStatus(null);
    setIsCreateSaving(false);
  };

  const handleCreateInputChange = (field, value) => {
    setCreateFormData((prev) => {
      const base = prev || getInitialCreateFormData();
      if (field === "Agent") {
        const normalizedAgent = normalizeAgentRecord(value);
        return {
          ...base,
          Agent: normalizedAgent,
          Agent_ID: normalizedAgent?.__optionId || "",
        };
      }
      return {
        ...base,
        [field]: value,
      };
    });
  };

  const handleCreateSave = async () => {
    const missingFields = getMissingRequestFields(createFormData);
    if (missingFields.length) {
      setCreateError(
        `Please fill the required fields: ${missingFields.join(", ")}.`
      );
      setCreateSaveStatus("error");
      return;
    }
    setIsCreateSaving(true);
    setCreateSaveStatus(null);
    setCreateError(null);
    try {
      const creator = await ensureZohoReady();
      const createHandler = resolveCreateHandler(creator);
      if (!createHandler) {
        throw new Error("Zoho add API is not available.");
      }
      const dataModule = getCreatorModule(creator, "DATA");
      const appName = getAppLinkName() || "knowbal-one";
      const agentId =
        createFormData.Agent_ID ||
        getAgentOptionId(createFormData.Agent);
      const data = {
        Request_Date: formatDateForZoho(createFormData.Request_Date),
        Requested_Amount: createFormData.Requested_Amount,
        Received_Amount: createFormData.Received_Amount,
        Payment_Request_ID: createFormData.Payment_Request_ID,
        Request_Note: createFormData.Request_Note,
        Payment_Status: createFormData.Payment_Status,
        Payee_Location: createFormData.Payee_Location,
         Client:clientId
      };
      if (agentId) {
        data.Agent = agentId;
      }
      const createConfig = {
        app_name: appName,
        appName,
        form_name: PAYMENT_REQUEST_FORM_NAME,
        formName: PAYMENT_REQUEST_FORM_NAME,
        report_name: PAYMENT_REQUEST_REPORT_NAME,
        reportName: PAYMENT_REQUEST_REPORT_NAME,
        data,
        payload: { data },
      };
      const response = await createHandler(createConfig);
      if (response?.code !== 3000) {
        const errorMessage = getZohoResponseError(
          response,
          "Unable to create payment request."
        );
        throw new Error(errorMessage);
      }
      setCreateSaveStatus("success");
      let fetchedRecord = null;
      try {
        const newRecordId = response?.data?.ID || response?.data?.id;
        if (dataModule?.getRecords) {
          const criteria = newRecordId
            ? buildEqualityCriteria("ID", newRecordId)
            : buildEqualityCriteria("Client", clientId);
          if (criteria) {
            const recordResponse = await dataModule.getRecords({
              report_name: PAYMENT_REQUEST_REPORT_NAME,
              criteria,
              page: 1,
            });
            const record = recordResponse?.data?.[0];
            if (record) {
              fetchedRecord = prepareRequestRecord(record);
            }
          }
        }
      } catch (fetchError) {
        console.error("Unable to fetch newly created payment request:", fetchError);
      }
      const normalizedAgentSelection = normalizeAgentRecord(
        createFormData.Agent || createFormData.Agent_ID || agentId
      );
      const createdRecord =
        fetchedRecord ||
        prepareRequestRecord({
          ...createFormData,
          ...data,
          ...response?.data,
          Agent: normalizedAgentSelection,
        });
      setPaymentRequests((prev) => [createdRecord, ...prev]);
      setCreateFormData(getInitialCreateFormData());
      closeCreateForm();
    } catch (error) {
      setCreateError(error.message || "Unable to create payment request.");
      setCreateSaveStatus("error");
    } finally {
      setIsCreateSaving(false);
    }
  };

  const openReceiptForm = (request) => {
    if (!request) return;
    const todayIso = new Date().toISOString().slice(0, 10);
    setActiveReceiptRequest(request);
    setReceiptUploadFile(null);
    setReceiptFormData({
      Payment_Request: request.ID, 
      Payment_Request_ID: request.Payment_Request_ID,
      Received_Date: todayIso,
      Received_Amount: "",
      Payment_Mode: "Bank Transfer",
      Note: "",
      Client_ID:request?.Client?.ID,
      Reconciliation1:false
    });
    setReceiptError(null);
    setReceiptSaveStatus(null);
    setReceiptFormOpen(true);
  };

  const closeReceiptForm = () => {
    setReceiptFormOpen(false);
    setReceiptFormData(null);
    setReceiptError(null);
    setReceiptSaveStatus(null);
    setIsReceiptSaving(false);
    setActiveReceiptRequest(null);
    setReceiptUploadFile(null);
  };

  const handleReceiptInputChange = (field, value) => {
    setReceiptFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleReceiptFileChange = useCallback((file) => {
    setReceiptUploadFile(file);
    setReceiptFormData((prev) =>
      prev
        ? {
            ...prev,
            Attachment: file ? file.name : "",
          }
        : prev
    );
  }, []);

  const resolvePaymentRequestTemplate = (templates = emailTemplates) => {
    if (!templates.length) {
      return null;
    }
    const targetName = "payment request";
    return (
      templates.find((template) => {
        const templateName =
          template?.Template_Name ||
          template?.Template ||
          template?.Name ||
          "";
        return templateName.toString().toLowerCase().includes(targetName);
      }) || null
    );
  };

  const openEmailModal = async (request) => {
    if (!request) return;
    let templates = emailTemplates;
    if (!templates.length) {
      templates = (await loadEmailTemplates()) || [];
    }
    const assignedAgent = normalizeAgentRecord(request.Agent || request.Agent_ID);
    const clientName = getClientDisplayName(request);

    const defaultTemplate = resolvePaymentRequestTemplate(templates);
    const templateSubject =
      defaultTemplate?.Subject ||
      defaultTemplate?.Template_Subject ||
      defaultTemplate?.Subject_field ||
      defaultTemplate?.Template_Name ||
      "";
    const subject =
      templateSubject ||
      (request.Payment_Request_ID
        ? `Payment Request ${request.Payment_Request_ID}`
        : "Payment Request Details");
    const templateContent =
      defaultTemplate?.Email_Content ||
      defaultTemplate?.Template_Content ||
      "";

    const resolvedClientFirstName =
      clientDetails?.Name_of_Client1?.first_name ||
      clientDetails?.Name_of_Client?.first_name ||
      request?.Client?.Name_of_Client1?.first_name ||
      request?.Client?.Name_of_Client?.first_name ||
      request?.Client_Name ||
      clientName ||
      "";
    const resolvedClientId =
      clientDetails?.Client_ID ||
      clientDetails?.Clientid ||
      clientDetails?.ID ||
      request?.Client?.Client_ID ||
      request?.Client?.Clientid ||
      request?.Client?.ID ||
      getRequestClientIdentifier(request) ||
      "";
    const resolvedServiceName =
      serviceDetails?.Select_Service?.Service ||
      serviceDetails?.Service?.zc_display_value ||
      serviceDetails?.Service ||
      request?.Service_Name ||
      request?.Service ||
      "";
    const agentEmailFromOptions =
      agentOptions.find(
        (agent) =>
          agent.__optionId === normalizeRecordId(request.Agent_ID) &&
          agent.Login_Email_Address
      )?.Login_Email_Address || "";
      
    const stripePaymentUrl = ensureAbsoluteUrl(
      await fetchStripeIntegrationUrl(request)
    );
    
     console.log("stripePaymentUrl111" + stripePaymentUrl);
    let resolvedContent = templateContent || "";
    if (resolvedContent) {
      resolvedContent = resolvedContent.replace(
        /\{NAME\}/gi,
        resolvedClientFirstName
      );
      resolvedContent = resolvedContent.replace(
        /\{Requested Amount\}/gi,
        request?.Requested_Amount !== undefined &&
          request?.Requested_Amount !== null
          ? String(request.Requested_Amount)
          : ""
      );
       resolvedContent = resolvedContent.replace(
        /\{Request Note\}/gi,
        request?.Requested_Amount !== undefined &&
          request?.Requested_Amount !== null
          ? String(request.Request_Note)
          : "" )
      resolvedContent = resolvedContent.replace(
        /\{Client ID\}/gi,
        resolvedClientId
      );
      resolvedContent = resolvedContent.replace(
        /\{Agent ID\}/gi,
        agentEmailFromOptions ||
          (request?.Requested_Amount !== undefined &&
          request?.Requested_Amount !== null
            ? String(request.Agent_ID)
            : "")
      );
      resolvedContent = resolvedContent.replace(
        /\{Service\}/gi,
        resolvedServiceName
      );
      if (stripePaymentUrl) {
        const escapedPlaceholder = STRIPE_LINK_PLACEHOLDER.replace(
          /[.*+?^${}()|[\]\\]/g,
          "\\$&"
        );
       
        
        const anchorHtml = `<a href="${stripePaymentUrl}" target="_blank" rel="noopener noreferrer">${STRIPE_CTA_TEXT}</a>`;
        let replacedCta = false;
        const hrefDouble = new RegExp(
          `href="${escapedPlaceholder}"`,
          "gi"
        );
        const hrefSingle = new RegExp(
          `href='${escapedPlaceholder}'`,
          "gi"
        );
        if (hrefDouble.test(resolvedContent) || hrefSingle.test(resolvedContent)) {
          resolvedContent = resolvedContent
            .replace(hrefDouble, `href="${stripePaymentUrl}"`)
            .replace(hrefSingle, `href='${stripePaymentUrl}'`);
          replacedCta = true;
        }
        const escapedText = STRIPE_CTA_TEXT.replace(
          /[.*+?^${}()|[\]\\]/g,
          "\\$&"
        );
        const ctaAnchorPattern = new RegExp(
          `<a[^>]*>\\s*${escapedText}\\s*<\\/a>`,
          "gi"
        );
        if (ctaAnchorPattern.test(resolvedContent)) {
          resolvedContent = resolvedContent.replace(
            ctaAnchorPattern,
            anchorHtml
          );
          replacedCta = true;
        }
        const ctaBlockPattern = new RegExp(
          "Click here to pay by card[\\s\\S]*?(?=<|$)",
          "gi"
        );
        if (ctaBlockPattern.test(resolvedContent)) {
          resolvedContent = resolvedContent.replace(ctaBlockPattern, anchorHtml);
          replacedCta = true;
        }
        const lowerContent = resolvedContent.toLowerCase();
        const marker = "click here to pay by card";
        const markerIndex = lowerContent.indexOf(marker);
        if (markerIndex !== -1) {
          let endIndex = markerIndex;
          const spanCloseIndex = resolvedContent.indexOf(
            "</span>",
            markerIndex
          );
          const applyIndex = lowerContent.indexOf("apply)", markerIndex);
          if (spanCloseIndex !== -1 && spanCloseIndex < applyIndex + 20) {
            endIndex = spanCloseIndex + "</span>".length;
          } else if (applyIndex !== -1) {
            endIndex = applyIndex + "apply)".length;
          } else {
            endIndex = markerIndex + marker.length;
          }
          const snippet = resolvedContent.slice(markerIndex, endIndex).trim();
          const wrappedSnippet = `<a href="${stripePaymentUrl}" target="_blank" rel="noopener noreferrer">${snippet}</a>`;
          resolvedContent =
            resolvedContent.slice(0, markerIndex) +
            wrappedSnippet +
            resolvedContent.slice(endIndex);
          replacedCta = true;
        }
        const ctaTextPattern = new RegExp(escapedText, "gi");
        if (ctaTextPattern.test(resolvedContent)) {
          resolvedContent = resolvedContent.replace(
            ctaTextPattern,
            anchorHtml
          );
          replacedCta = true;
        }
        const placeholderRegex = new RegExp(escapedPlaceholder, "g");
        if (placeholderRegex.test(resolvedContent)) {
          const fallbackAnchor = `<a href="${stripePaymentUrl}" target="_blank" rel="noopener noreferrer">${stripePaymentUrl}</a>`;
          resolvedContent = resolvedContent.replace(
            placeholderRegex,
            fallbackAnchor
          );
          replacedCta = true;
        }
        if (!replacedCta) {
          resolvedContent = `${resolvedContent}<p>${anchorHtml}</p>`;
        }
      }
    }
    const templateId =
      defaultTemplate?.ID ||
      defaultTemplate?.id ||
      defaultTemplate?.Template_ID ||
      defaultTemplate?.Templateid ||
      "";

      
    setEmailFormData({
      Payment_Request_ID: request.Payment_Request_ID || "",
      Request_ID: request.ID || "",
      Assigned_User: assignedAgent?.__optionId || "",
      Client_Name: clientName || "",
      From: agentEmailFromOptions,
      To: clientDetails?.Email ,
      Subject: subject.replace(
        /\{Service\}/gi,
        resolvedServiceName
      ),
      Content: resolvedContent || buildEmailContent(request),
      CC: "",
      TemplateId: templateId || "",
    });
    setEmailPlaceholderValues({
      NAME: resolvedClientFirstName,
      SERVICE: resolvedServiceName,
      REQUESTED_AMOUNT:
        request?.Requested_Amount !== undefined &&
        request?.Requested_Amount !== null
          ? String(request.Requested_Amount)
          : "",
      REQUEST_NOTE:
        request?.Requested_Amount !== undefined &&
        request?.Requested_Amount !== null
          ? String(request.Request_Note || "")
          : "",
      CLIENT_ID: resolvedClientId,
      AGENT_ID:
        agentEmailFromOptions ||
        (request?.Requested_Amount !== undefined &&
        request?.Requested_Amount !== null
          ? String(request.Agent_ID)
          : ""),
    });
    setEmailError(null);
    setEmailSending(false);
    setEmailModalOpen(true);
  };

  const closeEmailModal = () => {
    setEmailModalOpen(false);
    setEmailFormData(null);
    setEmailError(null);
    setEmailSending(false);
  };

  const handleEmailFieldChange = (field, value) => {
    setEmailFormData((prev) => ({
      ...(prev || {}),
      [field]: value,
    }));
  };

  const handleSendEmail = async () => {
    if (!emailFormData) {
      return;
    }
    const toList = parseEmailList(emailFormData.To);
    if (!emailFormData.From) {
      setEmailError("From address is required.");
      return;
    }
    if (!toList.length) {
      setEmailError("Provide at least one recipient email.");
      return;
    }
    if (!emailFormData.Content) {
      setEmailError("Email content cannot be empty.");
      return;
    }
    setEmailError(null);
    setEmailSending(true);
    try {
      const creator = await ensureZohoReady();
      const createHandler = resolveCreateHandler(creator);
      if (!createHandler) {
        throw new Error("Zoho add API is not available for email logging.");
      }
      const sendMailHandler =
        window.ZOHO?.CREATOR?.UTIL?.sendMail ||
        creator?.UTIL?.sendMail ||
        creator?.sendMail ||
        window.ZOHO?.CREATOR?.API?.sendMail ||
        creator?.API?.sendMail ||
        resolveSendMailHandler(creator);
      // if (typeof sendMailHandler !== "function") {
      //   throw new Error("Zoho send mail API is unavailable.");
      // }
      const ccList = parseEmailList(emailFormData.CC);
      const subject = emailFormData.Subject || "Payment Request Details";
      const appName = getAppLinkName() || "knowbal-one";
      const ccRows = ccList.map((email) => ({ Email: email }));
      const emailRecordPayload = {
        Payment_Request: emailFormData.Request_ID || "",
        Payment_Request_ID: emailFormData.Payment_Request_ID || "",
        Assigned_User: emailFormData.Assigned_User || "",
        Client_Name: emailFormData.Client_Name || "",
        From: emailFormData.From,
        To: emailFormData.To,
        CC: ccRows,
        Subject_field: subject,
        Content: emailFormData.Content,
        Client: clientId || "",
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
        setEmailError(`Unable to send email${codeLabel}: ${createErrorMessage}`);
        return;
      }
      const requestConfig = {
        from_mail_id: emailFormData.From,
        fromAddress: emailFormData.From,
        to_mail_ids: toList,
        toAddress: toList.join(","),
        cc_mail_ids: ccList,
        ccAddress: ccList.join(","),
        subject,
        message: emailFormData.Content,
        content: emailFormData.Content,
      };
      if (typeof sendMailHandler === "function") {
        const sendResponse = await sendMailHandler(requestConfig);
        const sendErrorMessage = getZohoResponseErrorMessage(sendResponse);
        if (sendErrorMessage) {
          const codeLabel =
            sendResponse?.code !== undefined ? ` (code ${sendResponse.code})` : "";
          setEmailError(`Unable to send email${codeLabel}: ${sendErrorMessage}`);
          return;
        }
      } else {
        console.warn(
          "Zoho send mail API unavailable; proceeding with saved email record."
        );
      }
      closeEmailModal();
    } catch (err) {
      setEmailError(err?.message || "Unable to send email.");
    } finally {
      setEmailSending(false);
    }
  };

  const getReceiptParentRequest = () => {
    if (activeReceiptRequest) {
      return activeReceiptRequest;
    }
    if (!receiptFormData) {
      return null;
    }
    const requestRecordId = normalizeRecordId(receiptFormData.Payment_Request);
    if (requestRecordId) {
      const matchedById =
        paymentRequests.find(
          (req) => normalizeRecordId(req.ID) === requestRecordId
        ) || null;
      if (matchedById) {
        return matchedById;
      }
    }
    const requestDisplayValue = normalizeDisplayValue(
      receiptFormData.Payment_Request_ID
    );
    if (requestDisplayValue) {
      return (
        paymentRequests.find(
          (req) =>
            normalizeDisplayValue(
              req.Payment_Request_ID || req.Payment_Request?.zc_display_value
            ) === requestDisplayValue
        ) || null
      );
    }
    return null;
  };

  const handleReceiptSave = async () => {
    if (!receiptFormData?.Payment_Request) {
      setReceiptError("Missing payment request reference.");
      return;
    }
    setIsReceiptSaving(true);
    setReceiptError(null);
    setReceiptSaveStatus(null);
    try {
      const normalizedAmount = Number(receiptFormData.Received_Amount);
      if (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0) {
        throw new Error("Enter a valid received amount greater than zero.");
      }
      const parentRequest = getReceiptParentRequest();
      let updatedRequestTotal = null;
      let updatedPaymentStatus = null;
      const amountTolerance = 0.000001;
      if (parentRequest) {
        const existingReceiptsTotal = sumReceiptAmounts(
          getReceiptsForRequest(parentRequest)
        );
        const recordedTotal = Number(parentRequest.Received_Amount);
        const currentTotal = Number.isFinite(recordedTotal)
          ? Math.max(recordedTotal, existingReceiptsTotal)
          : existingReceiptsTotal;
        updatedRequestTotal = currentTotal + normalizedAmount;
        const requestedAmountValue = Number(parentRequest.Requested_Amount);
        if (
          Number.isFinite(requestedAmountValue) &&
          requestedAmountValue > 0 &&
          updatedRequestTotal - requestedAmountValue > amountTolerance
        ) {
          setReceiptError("You can't receive more than the requested amount.");
          setIsReceiptSaving(false);
          return;
        }
        if (Number.isFinite(requestedAmountValue) && requestedAmountValue > 0) {
          if (
            Math.abs(updatedRequestTotal - requestedAmountValue) <=
            amountTolerance
          ) {
            updatedPaymentStatus = "Paid";
          } else if (updatedRequestTotal > 0) {
            updatedPaymentStatus = "Partially Paid";
          } else {
            updatedPaymentStatus = "Pending";
          }
        } else if (updatedRequestTotal > 0) {
          updatedPaymentStatus = "Partially Paid";
        }
      }
      const creator = await ensureZohoReady();
      const createHandler = resolveCreateHandler(creator);
      if (!createHandler) {
        throw new Error("Zoho add API is not available.");
      }
      const appName = getAppLinkName() || "knowbal-one";
      const data = {
        Received_Date: formatDateForZoho(receiptFormData.Received_Date),
        Amount_Received: normalizedAmount,
        Payment_Mode:receiptFormData.Payment_Mode,
        Payment_Request: receiptFormData.Payment_Request,
        Client_ID: receiptFormData.Client_ID,
        Note: receiptFormData.Note,
        Un_Utilised_Amount:normalizedAmount
      };
      const config = {
        app_name: appName,
        appName,
        form_name: PAYMENT_RECEIPT_FORM_NAME,
        formName: PAYMENT_RECEIPT_FORM_NAME,
        report_name: PAYMENT_RECEIPT_REPORT_NAME,
        reportName: PAYMENT_RECEIPT_REPORT_NAME,
        data,
        payload: { data },
      };
      const response = await createHandler(config);
      if (response?.code !== 3000) {
        const errorMessage = getZohoResponseError(
          response,
          "Unable to add payment receipt."
        );
        throw new Error(errorMessage);
      }
      setReceiptSaveStatus("success");
      const newRecordId = response?.data?.ID || response?.data?.id;
      if (newRecordId && receiptUploadFile) {
        try {
          await uploadPaymentReceiptAttachment({
            recordId: newRecordId,
            file: receiptUploadFile,
          });
        } catch (uploadError) {
          console.warn(
            "Unable to upload payment receipt attachment",
            uploadError
          );
        }
      }
      const createdRecord = {
        ...data,
        ...response?.data,
        Payment_Request_ID:
          receiptFormData.Payment_Request_ID ??
          response?.data?.Payment_Request_ID,
        Received_Amount: normalizedAmount,
        Note: receiptFormData.Note,
      };
      setPaymentReceipts((prev) => [createdRecord, ...prev]);
      if (parentRequest?.ID && updatedRequestTotal !== null) {
        const updateHandler = resolveUpdateHandler(creator);
        if (!updateHandler) {
          throw new Error("Zoho update API is not available.");
        }
        const appName = getAppLinkName() || "knowbal-one";
        const requestUpdateData = {
          Received_Amount: updatedRequestTotal,
        };
        if (updatedPaymentStatus) {
          requestUpdateData.Payment_Status = updatedPaymentStatus;
        }
        const requestUpdateConfig = {
          app_name: appName,
          appName,
          report_name: PAYMENT_REQUEST_REPORT_NAME,
          reportName: PAYMENT_REQUEST_REPORT_NAME,
          form_name: PAYMENT_REQUEST_FORM_NAME,
          formName: PAYMENT_REQUEST_FORM_NAME,
          id: parentRequest.ID,
          data: requestUpdateData,
          payload: { data: requestUpdateData },
        };
        const requestUpdateResponse = await updateHandler(requestUpdateConfig);
        if (requestUpdateResponse?.code !== 3000) {
          const requestUpdateErrorMessage =
            requestUpdateResponse?.error?.join?.(", ") ||
            requestUpdateResponse?.error ||
            requestUpdateResponse?.message ||
            "Unable to update payment request totals.";
          throw new Error(requestUpdateErrorMessage);
        }
        setPaymentRequests((prev) =>
          prev.map((item) =>
            item.ID === parentRequest.ID
              ? {
                  ...item,
                  Received_Amount: updatedRequestTotal,
                  ...(updatedPaymentStatus
                    ? { Payment_Status: updatedPaymentStatus }
                    : {}),
                }
              : item
          )
        );
        setSelectedRequest((prev) =>
          prev && prev.ID === parentRequest.ID
            ? {
                ...prev,
                Received_Amount: updatedRequestTotal,
                ...(updatedPaymentStatus
                  ? { Payment_Status: updatedPaymentStatus }
                  : {}),
              }
            : prev
        );
        setRequestFormData((prev) =>
          prev && prev.ID === parentRequest.ID
            ? {
                ...prev,
                Received_Amount: updatedRequestTotal,
                ...(updatedPaymentStatus
                  ? { Payment_Status: updatedPaymentStatus }
                  : {}),
              }
            : prev
        );
        setActiveReceiptRequest((prev) =>
          prev && prev.ID === parentRequest.ID
            ? {
                ...prev,
                Received_Amount: updatedRequestTotal,
                ...(updatedPaymentStatus
                  ? { Payment_Status: updatedPaymentStatus }
                  : {}),
              }
            : prev
        );
      }
      await loadPaymentReceipts({ forceRefresh: true });
      closeReceiptForm();
    } catch (error) {
      setReceiptError(error.message || "Unable to add payment receipt.");
      setReceiptSaveStatus("error");
    } finally {
      setIsReceiptSaving(false);
    }
  };

  useEffect(() => {
    const normalizedClientId = normalizeRecordId(clientId);
    if (!normalizedClientId) {
      setPaymentRequests([]);
      paymentRequestFetchStateRef.current = {
        clientId: null,
        loading: false,
        loaded: false,
      };
      return;
    }

    const fetchState = paymentRequestFetchStateRef.current;
    if (
      fetchState.clientId === normalizedClientId &&
      (fetchState.loading || fetchState.loaded)
    ) {
      return;
    }

    paymentRequestFetchStateRef.current = {
      clientId: normalizedClientId,
      loading: true,
      loaded: false,
    };

    let isMounted = true;

      console.log(isMounted + "3333");
    const initWidget = async () => {
      try {
        const creator = await ensureZohoReady();
        const dataModule = getCreatorModule(creator, "DATA");
        if (!dataModule?.getRecords) {
          throw new Error("Zoho DATA.getRecords API unavailable.");
        }
        let paymentRequestRecords = [];
        try {
          const clientCriteriaCandidates =
            buildClientCriteriaList(normalizedClientId);
          if (!clientCriteriaCandidates.length) {
            throw new Error("Unable to resolve client criteria for requests.");
          }
          let paymentRequestResponse = null;
          let lastCriteriaError = null;
          let encounteredNoRecords = false;
          for (const clientCriteria of clientCriteriaCandidates) {
            try {
              paymentRequestResponse = await callWithRetry(() =>
                dataModule.getRecords({
                  report_name: PAYMENT_REQUEST_REPORT_NAME,
                  criteria: clientCriteria,
                })
              );
              break;
            } catch (requestError) {
              if (isNoRecordsError(requestError)) {
                lastCriteriaError = requestError;
                encounteredNoRecords = true;
                continue;
              }
              if (isCriteriaError(requestError)) {
                lastCriteriaError = requestError;
                continue;
              }
              throw requestError;
            }
          }
          if (!paymentRequestResponse) {
            if (lastCriteriaError && isNoRecordsError(lastCriteriaError)) {
              encounteredNoRecords = true;
            } else {
              throw lastCriteriaError || new Error("Unable to fetch requests.");
            }
          }
          paymentRequestRecords = encounteredNoRecords
            ? []
            : paymentRequestResponse?.data ?? [];
            
        } catch (requestError) {
          if (!isNoRecordsError(requestError)) {
            throw requestError;
          }
          paymentRequestRecords = [];
        }
        console.log(isMounted + "3333");
        

          const resolvedRecords = Array.isArray(paymentRequestRecords)
            ? paymentRequestRecords
            : Array.isArray(paymentRequestRecords?.data)
              ? paymentRequestRecords.data
              : Array.isArray(paymentRequestRecords?.records)
                ? paymentRequestRecords.records
                : [];
          const preparedRequests = resolvedRecords.map(
            (record) => prepareRequestRecord(record) || record
          );
          console.log("paymentRequestRecords3333" + JSON.stringify(preparedRequests));
          setPaymentRequests(preparedRequests);
  
        if (
          paymentRequestFetchStateRef.current.clientId === normalizedClientId
        ) {
          paymentRequestFetchStateRef.current = {
            clientId: normalizedClientId,
            loading: false,
            loaded: true,
          };
        }
      } catch (err) {
        console.error("Init/Fetch Error:", err);
        if (
          paymentRequestFetchStateRef.current.clientId === normalizedClientId
        ) {
          paymentRequestFetchStateRef.current = {
            clientId: null,
            loading: false,
            loaded: false,
          };
        }
      }
    };
    initWidget();
    return () => {
      isMounted = false;
    };
  }, [clientId, ensureZohoReady, prepareRequestRecord]);

  useEffect(() => {
    if ((selectedRequest || expandedRequestId) && !paymentReceiptsLoaded) {
      loadPaymentReceipts().catch((err) =>
        console.warn("Unable to load payment receipts", err)
      );
    }
  }, [
    expandedRequestId,
    loadPaymentReceipts,
    paymentReceiptsLoaded,
    selectedRequest,
  ]);

  useEffect(() => {
    if (agentsFetchedRef.current) {
      return;
    }
    agentsFetchedRef.current = true;
    let isMounted = true;
    const fetchActiveAgents = async () => {
      try {
        const creator = await ensureZohoReady();
        const dataModule = getCreatorModule(creator, "DATA");
        if (!dataModule?.getRecords) {
          throw new Error("Zoho DATA.getRecords API unavailable.");
        }
        const usersResponse = await dataModule.getRecords({
          report_name: USERS_REPORT_NAME,
          criteria: '(Status == "Active")',
        });
        if (isMounted && usersResponse?.data) {
          const seenUserIds = new Set();
          const normalizedUsers = [];
          usersResponse.data.forEach((user) => {
            const normalized = normalizeAgentRecord(user);
            if (
              normalized &&
              normalized.__optionId &&
              !seenUserIds.has(normalized.__optionId)
            ) {
              seenUserIds.add(normalized.__optionId);
              normalizedUsers.push(normalized);
            }
          });
          setAgentOptions(normalizedUsers);
        }
      } catch (err) {
        console.warn("Unable to fetch active users", err);
        if (isMounted) {
          setAgentOptions([]);
        }
      }
    };
    fetchActiveAgents();
    return () => {
      isMounted = false;
    };
  }, [ensureZohoReady, normalizeAgentRecord]);

      // console.log("agentOptions" + agentOptions);
return (
  <div className="container py-4">
    <header className="d-flex flex-column flex-md-row justify-content-between align-items-md-center mb-4">
      <div>
        
        <h1 className="h6 fw-bold mb-2">Payment requests </h1>
      </div>
    </header>

    <PaymentRequestsSection
      paymentRequests={paymentRequests}
      onAddRequest={openCreateForm}
      onUpdateRequest={handleRequestRowClick}
      onEmailRequest={openEmailModal}
      onMarkReceived={openReceiptForm}
      expandedRequestId={expandedRequestId}
      onToggleRequest={toggleRequestReceipts}
      expandedReceipts={expandedPaymentReceipts}
      expandedReceiptsTotal={expandedPaymentReceiptsTotal}
    />

    <CreatePaymentRequestModal
      isOpen={isCreateFormOpen}
      formData={createFormData}
      onChange={handleCreateInputChange}
      onClose={closeCreateForm}
      onSave={handleCreateSave}
      isSaving={isCreateSaving}
      error={createError}
      saveStatus={createSaveStatus}
      agents={agentOptions}
    />

    <PaymentRequestModal
      isOpen={isRequestFormOpen}
      selectedRequest={selectedRequest}
      formData={requestFormData}
      onChange={handleRequestInputChange}
      onClose={closeRequestForm}
      onSave={handleRequestSave}
      isLoading={isRequestLoading}
      isSaving={isRequestSaving}
      error={requestError}
      saveStatus={requestSaveStatus}
      relatedReceipts={relatedPaymentReceipts}
      relatedReceiptsTotal={relatedPaymentReceiptsTotal}
      agents={agentOptions}
    />

    <PaymentReceiptModal
      isOpen={isReceiptFormOpen}
      formData={receiptFormData}
      onChange={handleReceiptInputChange}
      onClose={closeReceiptForm}
      onSave={handleReceiptSave}
      isSaving={isReceiptSaving}
      error={receiptError}
      saveStatus={receiptSaveStatus}
      uploadFile={receiptUploadFile}
      onFileChange={handleReceiptFileChange}
    />
    <Suspense fallback={null}>
      <PaymentRequestEmailModal
        isOpen={isEmailModalOpen}
        formData={emailFormData || {}}
        agentOptions={agentOptions}
        emailTemplates={emailTemplates}
        placeholderValues={emailPlaceholderValues || {}}
        onChange={handleEmailFieldChange}
        onClose={closeEmailModal}
        onSend={handleSendEmail}
        isSending={isEmailSending}
        error={emailError}
      />
    </Suspense>
  </div>
);
}

export default Acconts;
