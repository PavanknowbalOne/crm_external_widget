import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

function Acconts() {
  const [paymentRequests, setPaymentRequests] = useState([]);
  const [paymentReceipts, setPaymentReceipts] = useState([]);
  const [, setUtilization] = useState([]);
  const zohoInitPromiseRef = useRef(null);
  const zohoSdkPromiseRef = useRef(null);
  const [isRequestFormOpen, setRequestFormOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [requestFormData, setRequestFormData] = useState(null);
  const [isRequestLoading, setIsRequestLoading] = useState(false);
  const [requestError, setRequestError] = useState(null);
  const [isRequestSaving, setIsRequestSaving] = useState(false);
  const [requestSaveStatus, setRequestSaveStatus] = useState(null);
  const [viewportHeight, setViewportHeight] = useState(window.innerHeight);
  const [viewportWidth, setViewportWidth] = useState(window.innerWidth);
  const [requestSearch, setRequestSearch] = useState("");
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

  const filteredPaymentRequests = useMemo(() => {
    if (!requestSearch) {
      return paymentRequests;
    }
    const term = requestSearch.toLowerCase();
    return paymentRequests.filter((req) => {
      return (
        req.Payment_Request_ID?.toLowerCase().includes(term) ||
        req.Request_Note?.toLowerCase().includes(term) ||
        req.Payment_Status?.toLowerCase().includes(term) ||
        req.Agent?.zc_display_value?.toLowerCase().includes(term)
      );
    });
  }, [paymentRequests, requestSearch]);

  
  const DEFAULT_APP_LINK_NAME =
    process.env.REACT_APP_ZOHO_APP_LINK_NAME || "knowbal-one";
  const PAYMENT_REQUEST_REPORT_NAME = "Payment_Requests";
  const PAYMENT_REQUEST_FORM_NAME = "Payment_Request";
  const PAYMENT_RECEIPT_REPORT_NAME = "Payments_Received";
  const PAYMENT_RECEIPT_FORM_NAME = "Payment_Received";
  const PAYMENT_UTILIZATION_REPORT_NAME = "Payment_Utilizations";
  const USERS_REPORT_NAME = "All_Users";

  const getAgentOptionId = (candidate) => {
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
  };

  const getAgentOptionLabel = (candidate) => {
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
  };

  const normalizeAgentRecord = (candidate) => {
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
  };

  const prepareRequestRecord = (record) => {
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
  };

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

  const getAppLinkName = () => {
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
  };

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

  const loadZohoSdk = () => {
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
  };

  const ensureZohoReady = async () => {
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
        criteria: `(Payment_Request_ID == "${requestId}")`,
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
      const normalizedAgentSelection = normalizeAgentRecord(
        createFormData.Agent || createFormData.Agent_ID || agentId
      );
      const createdRecord = prepareRequestRecord({
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
    setReceiptFormData({
      Payment_Request: request.ID, 
      Payment_Request_ID: request.Payment_Request_ID,
      Received_Date: todayIso,
      Received_Amount: "",
      Payment_Mode: "",
      Payment_Reference: "",
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
  };

  const handleReceiptInputChange = (field, value) => {
    setReceiptFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
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
        Payment_Reference: receiptFormData.Payment_Reference,
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
      const createdRecord = {
        ...data,
        ...response?.data,
        Payment_Request_ID:
          receiptFormData.Payment_Request_ID ??
          response?.data?.Payment_Request_ID,
        Received_Amount: normalizedAmount,
        Payment_Reference: receiptFormData.Payment_Reference,
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
      closeReceiptForm();
    } catch (error) {
      setReceiptError(error.message || "Unable to add payment receipt.");
      setReceiptSaveStatus("error");
    } finally {
      setIsReceiptSaving(false);
    }
  };



    useEffect(() => {
      const initWidget = async () => {
        try {
          const creator = await ensureZohoReady();
        
          const dataModule = getCreatorModule(creator, "DATA");
          if (!dataModule?.getRecords) {
            throw new Error("Zoho DATA.getRecords API unavailable.");
          }
          const paymentRequestResponse = await dataModule.getRecords({
            report_name: PAYMENT_REQUEST_REPORT_NAME,
          });
          if (paymentRequestResponse && paymentRequestResponse.data) {
            const preparedRequests = paymentRequestResponse.data.map(
              (record) => prepareRequestRecord(record) || record
            );
            setPaymentRequests(preparedRequests);
          }

          const PaymentreceiptResponse = await dataModule.getRecords({
            report_name: PAYMENT_RECEIPT_REPORT_NAME,
          });
          if (PaymentreceiptResponse && PaymentreceiptResponse.data) {
            setPaymentReceipts(PaymentreceiptResponse.data);
            // console.log(
            //   "PaymentreceiptResponse",
            //   PaymentreceiptResponse
            // );
          }
          const PaymentUtilizationResponse = await dataModule.getRecords({
            report_name: PAYMENT_UTILIZATION_REPORT_NAME,
          });
          if (PaymentUtilizationResponse && PaymentUtilizationResponse.data) {
            setUtilization(PaymentUtilizationResponse.data);
            // console.log(
            //   "PaymentUtilizationResponse",
            //   PaymentUtilizationResponse
            // );
          }
          const usersResponse = await dataModule.getRecords({
            report_name: USERS_REPORT_NAME,
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
        } catch (err) {
          console.error("Init/Fetch Error:", err);
        }
      };
      initWidget();
      // Resize Handler
      const handleResize = () => {
        setViewportHeight(window.innerHeight);
        setViewportWidth(window.innerWidth);
      };
      window.addEventListener("resize", handleResize);
      return () => window.removeEventListener("resize", handleResize);
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

return (
  <div className="container py-4">
    <header className="d-flex flex-column flex-md-row justify-content-between align-items-md-center mb-4">
      <div>
        <p className="text-uppercase text-muted mb-1">Finance Overview</p>
        <h1 className="h3 fw-bold mb-2">Accounts Dashboard</h1>
        <p className="text-muted mb-0">
          Monitor payment requests and utilization in one place.
        </p>
      </div>
      <div className="text-md-end mt-3 mt-md-0">
        <p className="text-muted mb-1">Viewport</p>
        <span className="badge text-bg-light">
          {viewportWidth} × {viewportHeight}
        </span>
      </div>
    </header>

    <PaymentRequestsSection
      paymentRequests={filteredPaymentRequests}
      requestSearch={requestSearch}
      onSearchChange={setRequestSearch} 
      onAddRequest={openCreateForm}
      onUpdateRequest={handleRequestRowClick}
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
    />
  </div>
);
}

export default Acconts;
