import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Acconts from "./Acconts";
import Invoices from "../Invoices/Invoices";
import { normalizeRecordId } from "./utils/recordUtils";

const CLIENT_ID_PARAM_KEYS = [
  "Client_id",
  "client_id",
  "Clientid",
  "clientid",
  "ClientID",
  "clientID",
];

const SERVICE_ID_PARAM_KEYS = [
  "Serviceid",
  "serviceid",
  "Service_id",
  "service_id",
  "ServiceID",
  "serviceID",
  "Service",
  "service",
];

const resolveParamFromParams = (params, keys) => {
  if (!params || !keys?.length) {
    return "";
  }
  for (const key of keys) {
    if (params[key] !== undefined && params[key] !== null) {
      return params[key];
    }
  }
  return "";
};

const getCreatorModule = (creatorObj, moduleName) => {
  const candidates = [
    creatorObj,
    creatorObj?.CREATOR,
    creatorObj?.CreatorSDK,
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

const buildEqualityCriteria = (fieldName, value) => {
  if (!fieldName || value === undefined || value === null || value === "") {
    return "";
  }
  const raw = String(value).trim();
  const numericPattern = /^-?\d+$/;
  const isNumeric = numericPattern.test(raw);
  const safeValue = isNumeric
    ? raw
    : `"${raw.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
  return `(${fieldName} == ${safeValue})`;
};

function AccountsModule() {
  const [clientId, setClientId] = useState(null);
  const [serviceId, setServiceId] = useState(null);
  const [clientDetails, setClientDetails] = useState(null);
  const [serviceDetails, setServiceDetails] = useState(null);

  const zohoSdkPromiseRef = useRef(null);
  const zohoInitPromiseRef = useRef(null);

  const applyClientId = useCallback((candidate) => {
    if (!candidate) return;
    const normalized = normalizeRecordId(candidate);
    if (!normalized) return;
    setClientId((current) => (current === normalized ? current : normalized));
  }, []);

  const applyServiceId = useCallback((candidate) => {
    if (!candidate) return;
    const normalized = normalizeRecordId(candidate);
    if (!normalized) return;
    setServiceId((current) => (current === normalized ? current : normalized));
  }, []);

  const extractParamFromUrl = useCallback((keys) => {
    if (typeof window === "undefined" || !window.location) {
      return "";
    }
    const searchParams = new URLSearchParams(window.location.search || "");
    for (const key of keys) {
      const value = searchParams.get(key);
      if (value) {
        return value;
      }
    }
    const hash = window.location.hash || "";
    const queryIndex = hash.indexOf("?");
    if (queryIndex >= 0 && queryIndex + 1 < hash.length) {
      const hashQuery = hash.substring(queryIndex + 1);
      const hashParams = new URLSearchParams(hashQuery);
      for (const key of keys) {
        const value = hashParams.get(key);
        if (value) {
          return value;
        }
      }
    }
    return "";
  }, []);

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

  useEffect(() => {
    let isMounted = true;
    const fetchIds = async () => {
      let resolvedClientViaZoho = false;
      let resolvedServiceViaZoho = false;
      try {
        await ensureZohoReady();
        const handler =
          window.ZOHO?.CREATOR?.UTIL?.getQueryParams ||
          window.ZOHO?.CREATOR?.getQueryParams ||
          window.ZOHO?.CREATOR?.API?.getQueryParams;
        if (typeof handler === "function") {
          const params = await handler();
          const clientCandidate = resolveParamFromParams(
            params,
            CLIENT_ID_PARAM_KEYS
          );
          if (clientCandidate) {
            applyClientId(clientCandidate);
            resolvedClientViaZoho = true;
          }
          const serviceCandidate = resolveParamFromParams(
            params,
            SERVICE_ID_PARAM_KEYS
          );
          if (serviceCandidate) {
            applyServiceId(serviceCandidate);
            resolvedServiceViaZoho = true;
          }
        }
      } catch (err) {
        console.warn("Unable to fetch Zoho Creator query params", err);
      }
      if (!resolvedClientViaZoho) {
        const fallbackClient = extractParamFromUrl(CLIENT_ID_PARAM_KEYS);
        if (fallbackClient) {
          applyClientId(fallbackClient);
        }
      }
      if (!resolvedServiceViaZoho) {
        const fallbackService = extractParamFromUrl(SERVICE_ID_PARAM_KEYS);
        if (fallbackService) {
          applyServiceId(fallbackService);
        }
      }
    };
    if (isMounted) {
      fetchIds();
    }
    const handleLocationChange = () => {
      const clientCandidate = extractParamFromUrl(CLIENT_ID_PARAM_KEYS);
      if (clientCandidate) {
        applyClientId(clientCandidate);
      }
      const serviceCandidate = extractParamFromUrl(SERVICE_ID_PARAM_KEYS);
      if (serviceCandidate) {
        applyServiceId(serviceCandidate);
      }
    };
    window.addEventListener("hashchange", handleLocationChange);
    window.addEventListener("popstate", handleLocationChange);
    return () => {
      isMounted = false;
      window.removeEventListener("hashchange", handleLocationChange);
      window.removeEventListener("popstate", handleLocationChange);
    };
  }, [
    applyClientId,
    applyServiceId,
    ensureZohoReady,
    extractParamFromUrl,
  ]);

  useEffect(() => {
    let isMounted = true;
    const fetchClientDetails = async () => {
      const normalized = normalizeRecordId(clientId);
      if (!normalized) {
        if (isMounted) {
          setClientDetails(null);
        }
        return;
      }
      try {
        const creator = await ensureZohoReady();
        const dataModule = getCreatorModule(creator, "DATA");
        if (!dataModule?.getRecords) {
          throw new Error("Zoho DATA.getRecords API unavailable.");
        }
        const response = await dataModule.getRecords({
          report_name: "All_Clients",
          criteria: buildEqualityCriteria("ID", normalized),
          page: 1,
          per_page: 1,
        });
        if (isMounted) {
          setClientDetails(response?.data?.[0] || null);
        }
      } catch (err) {
        console.warn("Unable to fetch client details", err);
        if (isMounted) {
          setClientDetails(null);
        }
      }
    };
    fetchClientDetails();
    return () => {
      isMounted = false;
    };
  }, [clientId, ensureZohoReady]);

  useEffect(() => {
    let isMounted = true;
    const fetchServiceDetails = async () => {
      const normalized = normalizeRecordId(serviceId);
      if (!normalized) {
        if (isMounted) {
          setServiceDetails(null);
        }
        return;
      }
      try {
        const creator = await ensureZohoReady();
        const dataModule = getCreatorModule(creator, "DATA");
        if (!dataModule?.getRecords) {
          throw new Error("Zoho DATA.getRecords API unavailable.");
        }
        const response = await dataModule.getRecords({
          report_name: "All_Leads_Marketing",
          criteria: buildEqualityCriteria("ID", normalized),
          page: 1,
          per_page: 1,
        });
        
        if (isMounted) {
          setServiceDetails(response?.data?.[0] || null);
        }
      } catch (err) {
        console.warn("Unable to fetch service details", err);
        if (isMounted) {
          setServiceDetails(null);
        }
      }
    };
    fetchServiceDetails();
    return () => {
      isMounted = false;
    };
  }, [serviceId, ensureZohoReady]);

  const normalizedClientId = useMemo(
    () => normalizeRecordId(clientId),
    [clientId]
  );

  const normalizedServiceId = useMemo(
    () => normalizeRecordId(serviceId),
    [serviceId]
  );

  return (
    <div className="container py-4">
      <h1 className="h4 mb-4"> Client Account</h1>
      <Acconts
        clientId={normalizedClientId}
        serviceId={normalizedServiceId}
        clientDetails={clientDetails}
        serviceDetails={serviceDetails}
      />
      <hr className="my-4" />
      <Invoices
        clientId={normalizedClientId}
        serviceId={normalizedServiceId}
        clientDetails={clientDetails}
        serviceDetails={serviceDetails}
      />
    </div>
  );
}

export default AccountsModule;
