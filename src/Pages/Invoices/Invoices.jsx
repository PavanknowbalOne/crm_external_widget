import React, {
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

function Invoices() {
  const [invoices, setInvoices] = useState([]);
  const [invoiceSearch, setInvoiceSearch] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [editorMode, setEditorMode] = useState("create");
  const [editingInvoice, setEditingInvoice] = useState(null);
  const [isInvoiceEditorLoading, setInvoiceEditorLoading] = useState(false);
  const [invoiceEditorError, setInvoiceEditorError] = useState(null);
  const [viewportHeight, setViewportHeight] = useState(window.innerHeight);
  const [viewportWidth, setViewportWidth] = useState(window.innerWidth);
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


  const formatCurrency = (value) => {
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
      const response = await dataModule.getRecords(requestPayload);
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


  const fetchInvoicesData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const creator = await ensureZohoReady();
      const dataModule = getCreatorModule(creator, "DATA");
      if (!dataModule?.getRecords) {
        throw new Error("Zoho DATA.getRecords API unavailable.");
      }
      const response = await dataModule.getRecords({
        report_name: INVOICE_REPORT_NAME,
      });
      const invoiceRecords = response?.data ?? [];
      let allLineItems = [];
      try {
        allLineItems = await fetchAllRecordsForReport({
          dataModule,
          reportName: INVOICE_LINE_FORM_NAME,
        });
        setInvoiceLineItemsCache(allLineItems);
      } catch (lineItemError) {
        console.warn("Unable to fetch invoice line items", lineItemError);
        allLineItems = [];
      }
      const lineItemLookup = buildLineItemsLookup(allLineItems);
      const invoicesWithLineItems = invoiceRecords.map((invoice) => ({
        ...invoice,
        Line_Items: getLineItemsForInvoice(lineItemLookup, invoice),
      }));
      setInvoices(invoicesWithLineItems);
      const usersResponse = await dataModule.getRecords({
        report_name: USERS_REPORT_NAME,
      });
      if (usersResponse?.data) {
        const seen = new Set();
        const normalizedUsers = usersResponse.data
          .map((user) => {
            if (!user?.ID) return null;
            if (seen.has(user.ID)) return null;
            seen.add(user.ID);
            return {
              __optionId: user.ID,
              __optionLabel:
                user.Name1?.zc_display_value ||
                [user.Name1?.first_name, user.Name1?.last_name]
                  .filter(Boolean)
                  .join(" ") ||
                user.Login_Email_Address ||
                `User ${user.ID}`,
            };
          })
          .filter(Boolean);
        setAgentOptions(normalizedUsers);
      }
      const servicesResponse = await dataModule.getRecords({
        report_name: SERVICES_REPORT_NAME,
      });
      console.log("servicesResponse", servicesResponse);
      
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
      setError(err.message || "Unable to fetch invoices.");
      setInvoices([]);
    } finally {
      setIsLoading(false);
    }
  }, [ensureZohoReady]);

  const fetchPaymentUtilizations = useCallback(
    async (invoiceRecord) => {
      const invoiceIdentifier = getInvoiceIdentifier(invoiceRecord);
      if (!invoiceIdentifier) {
        return [];
      }
      const creator = await ensureZohoReady();
      const dataModule = getCreatorModule(creator, "DATA");
      if (!dataModule?.getRecords) {
        throw new Error("Zoho DATA.getRecords API unavailable.");
      }
      const candidateFields = ["Invoice", "Invoice_Number"];
      const isTypeMismatchMessage = (message = "") => {
        const normalized = message.toLowerCase();
        return (
          normalized.includes("left expression is of type") ||
          normalized.includes("right expression is of type")
        );
      };
      for (const field of candidateFields) {
        const preferString = /Number/i.test(field);
        const treatOptions = preferString ? [true, false] : [false, true];
        for (const treatAsStringOption of treatOptions) {
          const criteria = buildCriteria(field, invoiceIdentifier, {
            treatAsString: treatAsStringOption,
          });
          if (!criteria) {
            continue;
          }
          try {
            const response = await dataModule.getRecords({
              report_name: PAYMENT_UTILIZATION_REPORT_NAME,
              criteria,
              page: 1,
              per_page: 200,
            });
            if (Array.isArray(response?.data)) {
              return response.data;
            }
          } catch (candidateError) {
            const errorMessage =
              candidateError?.message ||
              candidateError?.data?.message ||
              "";
            const normalized = errorMessage.toLowerCase();
            const isCriteriaError =
              candidateError?.code === 3330 ||
              normalized.includes("invalid criteria") ||
              isTypeMismatchMessage(errorMessage);
            if (isCriteriaError) {
              continue;
            }
            throw candidateError;
          }
        }
      }
      return [];
    },
    [ensureZohoReady]
  );

  const fetchAllPaymentReceipts = useCallback(async () => {
    const creator = await ensureZohoReady();
    const dataModule = getCreatorModule(creator, "DATA");
    if (!dataModule?.getRecords) {
      throw new Error("Zoho DATA.getRecords API unavailable.");
    }
    const receipts = await fetchAllRecordsForReport({
      dataModule,
      reportName: PAYMENT_RECEIPT_REPORT_NAME,
    });
    return receipts;
  }, [ensureZohoReady]);

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
    fetchInvoicesData();

    const handleResize = () => {
      setViewportHeight(window.innerHeight);
      setViewportWidth(window.innerWidth);
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [fetchInvoicesData]);

  const buildInvoiceFormPayload = (invoice) => {
    console.log("invoice" + JSON.stringify(invoice));

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
      Email: invoice.Email || "",
      Phone_Number: invoice.Phone_Number || invoice.Phone || "",
      Phone_Country_Code: invoice.Phone_Country_Code || "",
      Promo_Code: invoice.Promo_Code || "",
      Invoice_Notes: invoice.Invoice_Notes || "",
      Total_Amount: invoice.Total_Amount || 0,
    };

    return payload;
  };

  const filteredInvoices = useMemo(() => {
    if (!invoiceSearch) {
      return invoices;
    }
    const term = invoiceSearch.toLowerCase();
    return invoices.filter((invoice) => {
      return (
        invoice.Invoice_Number?.toLowerCase().includes(term) ||
        invoice.Agent?.zc_display_value?.toLowerCase().includes(term) ||
        invoice.Email?.toLowerCase().includes(term)
      );
    });
  }, [invoiceSearch, invoices]);

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
    GST_Type: item.GST_Type || item.GST || "NA",
    GST_Amount: Number(item.GST_Amount) || 0,
    Item_Notes: item.Item_Notes || item.Notes || "",
  });

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
      console.log(response);
        console.log(payload);
      
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
        const response = await dataModule.getRecords({
          report_name: INVOICE_REPORT_NAME,
          criteria: buildCriteria(criteriaField, criteriaValue),
          page: 1,
          per_page: 1,
        });
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
          paymentUtilizations = await fetchPaymentUtilizations(record);
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
        const utilizations = await fetchPaymentUtilizations(invoiceRecord);
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
            next.Total_Received_Amount = Number.isFinite(normalizedAmount)
              ? normalizedAmount
              : "";
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
        const normalizedReceipts = receipts.map((receipt, index) => {
          const optionId = receipt?.ID || receipt?.id || `receipt-${index}`;
          const label =
            receipt?.Receive_ID ||
            receipt?.Payment_Receipt_ID ||
            receipt?.Receipt_Number ||
            receipt?.Reference_Number ||
            receipt?.Payment_Request_ID ||
            `Receipt ${optionId}`;
          const amountCandidate =
            receipt?.Un_Utilised_Amount 
           
        
          const amount = amountCandidate === "" ? "" : Number(amountCandidate);
          return {
            value: optionId,
            label,
            amount: Number.isFinite(amount) ? amount : "",
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
          invoiceRecord
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
        Client_ID: utilizationFormData.Client_ID || "",
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
      <InvoiceHeader
        viewportWidth={viewportWidth}
        viewportHeight={viewportHeight}
      />
      <InvoiceListCard
        invoiceSearch={invoiceSearch}
        onSearchChange={setInvoiceSearch}
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
    </div>
  );
}

export default Invoices;
