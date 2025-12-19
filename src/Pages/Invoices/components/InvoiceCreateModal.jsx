import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import PhoneInput from "react-phone-input-2";
import "react-phone-input-2/lib/style.css";
import { formatDateForInput } from "../../Accounts/utils/recordUtils";

const getInitialFormData = () => ({
  Service: "",
  Invoice_Date: formatDateForInput(new Date()),
  Billing_Name: "",
  Billing_Address: "",
  Billing_Address_Line_1: "",
  Billing_Address_Line_2: "",
  City: "",
  State: "",
  Postal_Code: "",
  Country: "",
  Agent: "",
  Email: "",
  Phone_Number: "",
  Phone_Country_Code: "+91",
  Phone_Country_Iso: "IN",
  Promo_Code: "",
  Invoice_Notes: "",
});

const createLineItem = () => ({
  id: `${Date.now()}-${Math.random()}`,
  Service: "",
  Service_Id: "",
  Service_Search: "",
  Description: "",
  Price: "",
  Discount: "0",
  GST_Type: "NA",
  GST_Amount: "",
  Item_Notes: "",
  Invoice: "",
});

const StackField = ({ label, required, children, helper }) => (
  <div className="invoice-stack-field">
    <label className="invoice-stack-label text-muted small mb-1">
      {label} {required && <span className="text-danger">*</span>}
    </label>
    {children}
    {helper && <small className="text-muted d-block mt-1">{helper}</small>}
  </div>
);

const InlineField = ({ label, required, children, alignTop = false }) => (
  <div className={`invoice-inline-field${alignTop ? " align-top" : ""}`}>
    <label className="invoice-inline-label text-muted small mb-0">
      {label} {required && <span className="text-danger">*</span>}
    </label>
    <div className="invoice-inline-control flex-grow-1">{children}</div>
  </div>
);

const normalizeIdValue = (value) => {
  if (value === undefined || value === null || value === "") {
    return "";
  }
  if (typeof value === "object") {
    return (
      value.ID ||
      value.id ||
      value.__optionId ||
      value.value ||
      value.Service_Id ||
      value.Agent_ID ||
      ""
    );
  }
  return String(value);
};

function InvoiceCreateModal({
  isOpen,
  onClose,
  onSave,
  onUpdate,
  mode = "create",
  initialData = null,
  isLoading = false,
  loadError = null,
  agentOptions = [],
  serviceOptions = [],
  formatCurrency,
}) {
  const [formData, setFormData] = useState(getInitialFormData());
  const [lineItems, setLineItems] = useState([createLineItem()]);
  const [formError, setFormError] = useState(null);
  const [activeServiceDropdown, setActiveServiceDropdown] = useState(null);
  const serviceDropdownRefs = useRef({});
  const [serviceDropdownStyle, setServiceDropdownStyle] = useState(null);
  const serviceLookup = useMemo(() => {
    const lookup = new Map();
    serviceOptions.forEach((service) => {
      if (!service || service.__optionId === undefined || service.__optionId === null) {
        return;
      }
      lookup.set(String(service.__optionId), service.__optionLabel || "");
    });
    return lookup;
  }, [serviceOptions]);

  const mapInvoiceToFormState = useCallback((data) => {
    if (!data) {
      return getInitialFormData();
    }
    return {
      ...getInitialFormData(),
      ...data,
      Service: normalizeIdValue(
        data.Invoice_Service_ID ||
          data.Invoice_Service ||
          data.Service ||
          data.Service_ID
      ),
      Agent: normalizeIdValue(data.Agent_ID || data.Agent),
      Phone_Number: data.Phone_Number || data.Phone || "",
      Phone_Country_Code: data.Phone_Country_Code || "+91",
      Phone_Country_Iso:
        data.Phone_Country_Iso ||
        data.Phone_Country_Code ||
        "IN",
      Invoice_Date: formatDateForInput(data.Invoice_Date) || "",
    };
  }, []);

  const mapInvoiceLineItems = useCallback(
    (items, invoiceId) => {
      if (!items || !items.length) {
        return [createLineItem()];
      }
      return items.map((item) => {
        const rawServiceId =
          item.Service_Id ||
          item.Service?.ID ||
          item.Service?.id ||
          item.Service ||
          item.Service_ID ||
          item.Service_Number ||
          "";
        const serviceId = normalizeIdValue(rawServiceId);
        const serviceLabel =
          serviceLookup.get(serviceId) ||
          item.Service?.zc_display_value ||
          item.Service_Name ||
          item.Service ||
          "";
        return {
          id: `${item.ID || item.id || Date.now()}-${Math.random()}`,
          ID: item.ID || item.Invoice_Line_Item_ID || item.Line_Item_ID || "",
          Service: serviceLabel || serviceId,
          Service_Id: serviceId,
          Service_Search:
            item.Service_Search || serviceLabel || item.Service || "",
          Description:
            item.Description ||
            item.Service_Description ||
            serviceLabel ||
            item.Service ||
            "",
          Price: item.Price || "",
          Discount: item.Discount || "0",
          GST_Type: item.GST_Type || item.GST || "NA",
          GST_Amount: item.GST_Amount || "",
          Item_Notes: item.Item_Notes || item.Notes || "",
          Invoice: invoiceId || item.Invoice || "",
        };
      });
    },
    [serviceLookup]
  );

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    if (mode === "edit") {
      if (initialData) {
        setFormData(mapInvoiceToFormState(initialData));
        const sourceLineItems =
          initialData.Line_Items || initialData.Invoice_Line_Items;
        setLineItems(mapInvoiceLineItems(sourceLineItems, initialData.ID));
        setFormError(null);
        setActiveServiceDropdown(null);
      }
      return;
    }
    setFormData(getInitialFormData());
    setLineItems([createLineItem()]);
    setFormError(null);
    setActiveServiceDropdown(null);
  }, [
    isOpen,
    mode,
    initialData,
    mapInvoiceToFormState,
    mapInvoiceLineItems,
  ]);

  useEffect(() => {
    if (!isOpen || !serviceOptions.length) {
      return;
    }
    setFormData((prev) => {
      if (!prev?.Service) {
        return prev;
      }
      const normalizedId = normalizeIdValue(prev.Service);
      if (normalizedId && serviceLookup.has(normalizedId)) {
        return prev;
      }
      const matchedService = serviceOptions.find(
        (service) =>
          service.__optionLabel &&
          service.__optionLabel.toLowerCase() ===
            String(prev.Service).toLowerCase()
      );
      if (!matchedService) {
        return prev;
      }
      return {
        ...prev,
        Service: matchedService.__optionId,
      };
    });
  }, [isOpen, serviceOptions, serviceLookup]);

  const totals = useMemo(() => {
    const subtotal = lineItems.reduce((sum, item) => {
      const price = Number(item.Price) || 0;
      return sum + price;
    }, 0);
    const discountAmount = lineItems.reduce((sum, item) => {
      const price = Number(item.Price) || 0;
      const discountPercent = Number(item.Discount) || 0;
      return sum + (price * discountPercent) / 100;
    }, 0);
    const gstTotal = lineItems.reduce((sum, item) => {
      const gst = Number(item.GST_Amount) || 0;
      const gstType = item.GST_Type || "NA";
      if (gstType === "Exclusive") {
        return sum + gst;
      }
      if (gstType === "Inclusive") {
        return sum + gst;
      }
      return sum;
    }, 0);
    const taxableAmount = subtotal - discountAmount;
    const taxAmount = gstTotal;
    const totalAmount = taxableAmount + gstTotal;
    return {
      subtotal,
      discountAmount,
      taxableAmount,
      taxAmount,
      totalAmount,
    };
  }, [lineItems]);

  const summaryFields = [
    { key: "subtotal", label: "Sub Total", value: totals.subtotal },
    { key: "discount", label: "Discount", value: totals.discountAmount },
    { key: "taxable", label: "Taxable Amount", value: totals.taxableAmount },
    { key: "gst", label: "GST Amount", value: totals.taxAmount },
    { key: "total", label: "Total Amount", value: totals.totalAmount },
  ];

  const handleFieldChange = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleLineItemChange = (id, field, value) => {
    setLineItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  const handleServiceSearchChange = (id, value) => {
    setLineItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, Service_Search: value } : item
      )
    );
  };

  const getServiceSearchTerm = (item) =>
    (item.Service_Search ?? item.Service ?? "").toLowerCase().trim();

  const getMatchingServices = (searchTerm) => {
    if (!searchTerm) {
      return serviceOptions;
    }
    return serviceOptions.filter((service) =>
      service.__optionLabel.toLowerCase().includes(searchTerm)
    );
  };

  const handleServiceSelect = (id, service) => {
    setLineItems((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              Service: service.__optionLabel,
              Service_Id: service.__optionId,
              Service_Search: service.__optionLabel,
              Description:
                item.Description || service.__optionLabel || "",
            }
          : item
      )
    );
    setActiveServiceDropdown(null);
  };

  const handleServiceDropdownToggle = (id) => {
    setActiveServiceDropdown((current) => {
      if (current === id) {
        setServiceDropdownStyle(null);
        return null;
      }
      updateServiceDropdownPosition(id);
      return id;
    });
  };

  const handlePhoneChange = (value, countryData, _, formattedValue) => {
    const normalizedPhone = (formattedValue || value || "").replace(/\s+/g, "");
    setFormData((prev) => ({
      ...prev,
      Phone_Number: normalizedPhone.startsWith("+")
        ? normalizedPhone
        : normalizedPhone
        ? `+${normalizedPhone}`
        : "",
      Phone_Country_Code: countryData?.dialCode
        ? `+${countryData.dialCode}`
        : "",
      Phone_Country_Iso: countryData?.countryCode
        ? countryData.countryCode.toUpperCase()
        : prev.Phone_Country_Iso,
    }));
  };

  useEffect(() => {
    if (!formData.Service) {
      return;
    }
    setLineItems((prev) => {
      if (prev.length === 0) {
        return prev;
      }
      const [first, ...rest] = prev;
      if (first.Service_Id || first.Service) {
        return prev;
      }
      const matchedService = serviceOptions.find(
        (service) => service.__optionId === formData.Service
      );
      if (!matchedService) {
        return prev;
      }
      const updatedFirst = {
        ...first,
        Service: matchedService.__optionLabel,
        Service_Id: matchedService.__optionId,
        Service_Search: matchedService.__optionLabel,
        Service_Description: matchedService.__optionLabel,
      };
      return [updatedFirst, ...rest];
    });
  }, [formData.Service, serviceOptions]);

  const updateServiceDropdownPosition = useCallback(
    (id) => {
      const trigger = serviceDropdownRefs.current[id];
      if (!trigger) {
        setServiceDropdownStyle(null);
        return;
      }
      const rect = trigger.getBoundingClientRect();
      const dropdownHeight = 300;
      const dropdownWidth = 200;
      const spacing = 12;
      const width = dropdownWidth;
      const left = Math.min(
        window.innerWidth - width - spacing,
        Math.max(spacing, rect.left)
      );
      const top = Math.max(spacing, rect.top - dropdownHeight - spacing);
      setServiceDropdownStyle({
        position: "fixed",
        top,
        left,
        width,
        height: dropdownHeight,
        display: "flex",
        flexDirection: "column",
        backgroundColor: "#fff",
        zIndex: 20000,
        borderRadius: "0.5rem",
        boxShadow: "0 12px 32px rgba(0,0,0,0.2)",
      });
    },
    []
  );

  useEffect(() => {
    if (!activeServiceDropdown) {
      setServiceDropdownStyle(null);
      return undefined;
    }
    const handleClickOutside = (event) => {
      const dropdownElement =
        serviceDropdownRefs.current[activeServiceDropdown];
      if (dropdownElement && !dropdownElement.contains(event.target)) {
        setActiveServiceDropdown(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    const handleWindowChange = () =>
      updateServiceDropdownPosition(activeServiceDropdown);
    handleWindowChange();
    window.addEventListener("scroll", handleWindowChange, true);
    window.addEventListener("resize", handleWindowChange);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("scroll", handleWindowChange, true);
      window.removeEventListener("resize", handleWindowChange);
    };
  }, [activeServiceDropdown, updateServiceDropdownPosition]);

  if (!isOpen) {
    return null;
  }

  const inputClass = "form-control form-control-sm";
  const selectClass = "form-select form-select-sm";

  const addLineItem = () => {
    setLineItems((prev) => [...prev, createLineItem()]);
  };

  const removeLineItem = (id) => {
    setLineItems((prev) =>
      prev.length > 1 ? prev.filter((item) => item.id !== id) : prev
    );
  };

  const handleReset = () => {
    if (mode === "edit" && initialData) {
      setFormData(mapInvoiceToFormState(initialData));
      const sourceLineItems =
        initialData.Line_Items || initialData.Invoice_Line_Items;
      setLineItems(mapInvoiceLineItems(sourceLineItems, initialData.ID));
    } else {
      setFormData(getInitialFormData());
      setLineItems([createLineItem()]);
    }
    setFormError(null);
    setActiveServiceDropdown(null);
  };

  const handleSave = async () => {
    const validationErrors = [];
    // if (!formData.Service) {
    //   validationErrors.push("Service is required.");
    // }
    if (!formData.Invoice_Date) {
      validationErrors.push("Invoice date is required.");
    }
    if (!formData.Agent) {
      validationErrors.push("Agent is required.");
    }
    if (!formData.Billing_Name) {
      validationErrors.push("Billing name is required.");
    }
    if (!formData.Phone_Number) {
      validationErrors.push("Phone number is required.");
    }
    const hasValidLineItem = lineItems.some(
      (item) => item.Service && item.Service.trim()
    );
    if (!hasValidLineItem) {
      validationErrors.push(
        "Add at least one invoice line item with a selected service."
      );
    }
    if (validationErrors.length > 0) {
      setFormError(validationErrors.join(" "));
      return;
    }
    const sanitizedLineItems = lineItems
      .map(({ id: _omit, ...rest }) => rest)
      .filter((item) => item.Service_Id || item.Service || item.Price);
    const selectedAgent =
      agentOptions.find((agent) => agent.__optionId === formData.Agent) || null;
    const selectedInvoiceService =
      serviceOptions.find(
        (service) => service.__optionId === formData.Service
      ) || null;
    const normalizedServiceValue = normalizeIdValue(formData.Service);
    const resolvedServiceOption =
      serviceOptions.find(
        (service) =>
          String(service.__optionId) === normalizedServiceValue ||
          service.__optionLabel === formData.Service
      ) || null;
    const resolvedServiceId = resolvedServiceOption
      ? String(resolvedServiceOption.__optionId)
      : normalizedServiceValue;
    const resolvedAgentId = normalizeIdValue(formData.Agent);
    const newInvoice = {
      ...formData,
      Service: resolvedServiceId || "",
      // Agent_ID: formData.Agent,
      // Invoice_Service_ID: formData.Service,
      Invoice_Date: formData.Invoice_Date,
      Billing_Name:formData.Billing_Name,
      ID: mode === "edit" ? initialData?.ID || formData.ID : undefined,
      Agent_ID: resolvedAgentId,
      Invoice_Service_ID: resolvedServiceId,
      Agent: selectedAgent
        ? {
            zc_display_value: selectedAgent.__optionLabel,
            ID: selectedAgent.__optionId,
          }
        : resolvedAgentId
        ? { ID: resolvedAgentId }
        : null,
      Invoice_Service: resolvedServiceOption
        ? {
            zc_display_value: resolvedServiceOption.__optionLabel,
            ID: resolvedServiceOption.__optionId,
          }
        : selectedInvoiceService
        ? {
            zc_display_value: selectedInvoiceService.__optionLabel,
            ID: selectedInvoiceService.__optionId,
          }
        : resolvedServiceId
        ? { ID: resolvedServiceId }
        : formData.Invoice_Service || null,
      Email: formData.Email,
      Phone_Number: formData.Phone_Number,
      Phone_Country_Code: formData.Phone_Country_Code,
      Total_Amount: totals.totalAmount,
      Invoice_Line_Items: sanitizedLineItems,
      Line_Items: sanitizedLineItems,
    };
    try {
      if (mode === "edit" && typeof onUpdate === "function") {
        await onUpdate(newInvoice);
      } else {
        await onSave(newInvoice);
      }
      setFormData(getInitialFormData());
      setLineItems([createLineItem()]);
      setFormError(null);
    } catch (saveError) {
      setFormError(saveError.message);
    }
  };

  return (
    <div
      className="modal fade show d-block"
      tabIndex="-1"
      role="dialog"
      style={{ backgroundColor: "rgba(0,0,0,0.4)" }}
      onClick={onClose}
    >
      <div
        className="modal-dialog modal-xl modal-dialog-centered invoice-modal-dialog"
        role="document"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-content shadow-lg border-0 invoice-modal-content">
          <div className="modal-header">
            <div>
              <h5 className="modal-title mb-0">Add Invoice</h5>
              <p className="text-muted small mb-0">
                Capture billing details and line items for this invoice.
              </p>
            </div>
            <button
              type="button"
              className="btn-close"
              aria-label="Close"
              onClick={onClose}
            ></button>
          </div>
          <div className="modal-body">
            {formError && (
              <div className="alert alert-danger py-2">{formError}</div>
            )}
            {mode === "edit" && loadError && (
              <div className="alert alert-danger py-2">{loadError}</div>
            )}
            {mode === "edit" &&
            (isLoading || (!initialData && !formData?.ID)) ? (
              <div className="d-flex align-items-center gap-2 py-4">
                <div className="spinner-border text-primary" role="status">
                  <span className="visually-hidden">Loading invoice…</span>
                </div>
                <span>Loading invoice details…</span>
              </div>
            ) : (
              <>
            <div className="invoice-form-grid">
              <div className="invoice-form-column">
                <InlineField label="Service" required>
                  <select
                    className={selectClass}
                    value={formData.Service}
                    onChange={(e) =>
                      handleFieldChange("Service", e.target.value)
                    }
                  >
                    <option value="">Select service</option>
                    {serviceOptions.map((service) => (
                      <option key={service.__optionId} value={service.__optionId}>
                        {service.__optionLabel}
                      </option>
                    ))}
                  </select>
                </InlineField>
                <InlineField label="Invoice Date" required>
                  <input
                    type="date"
                    className={inputClass}
                    value={formData.Invoice_Date}
                    onChange={(e) =>
                      handleFieldChange("Invoice_Date", e.target.value)
                    }
                  />
                </InlineField>
                <InlineField label="Agent" required>
                  <select
                    className={selectClass}
                    value={formData.Agent}
                    onChange={(e) => handleFieldChange("Agent", e.target.value)}
                  >
                    <option value="">Select agent</option>
                    {agentOptions.map((agent) => (
                      <option key={agent.__optionId} value={agent.__optionId}>
                        {agent.__optionLabel ||
                          [agent?.Name1?.first_name, agent?.Name1?.last_name]
                            .filter(Boolean)
                            .join(" ") ||
                          `Agent ${agent.__optionId}`}
                      </option>
                    ))}
                  </select>
                </InlineField>
                <InlineField label="Email">
                  <input
                    type="email"
                    className={inputClass}
                    value={formData.Email}
                    onChange={(e) => handleFieldChange("Email", e.target.value)}
                    placeholder="name@email.com"
                  />
                </InlineField>
                <InlineField label="Phone" required>
                  <PhoneInput
                    country={(formData.Phone_Country_Iso || "IN").toLowerCase()}
                    value={formData.Phone_Number}
                    onChange={handlePhoneChange}
                    enableSearch
                    inputProps={{
                      name: "phone",
                      required: true,
                      "aria-label": "Phone number",
                    }}
                    containerClass="invoice-phone-container"
                    inputClass="invoice-phone-input"
                    buttonClass="invoice-phone-flag"
                    dropdownClass="invoice-phone-dropdown"
                  />
                </InlineField>
              </div>
              <div className="invoice-form-column">
                <StackField label="Billing Name" required>
                  <input
                    type="text"
                    className={inputClass}
                    value={formData.Billing_Name}
                    onChange={(e) =>
                      handleFieldChange("Billing_Name", e.target.value)
                    }
                  />
                </StackField>
                <StackField label="Billing Address">
                  <input
                    type="text"
                    className={`${inputClass} mb-2`}
                    placeholder="Address Line 1"
                    value={formData.Billing_Address_Line_1}
                    onChange={(e) =>
                      handleFieldChange("Billing_Address_Line_1", e.target.value)
                    }
                  />
                  <input
                    type="text"
                    className={`${inputClass} mb-2`}
                    placeholder="Address Line 2"
                    value={formData.Billing_Address_Line_2}
                    onChange={(e) =>
                      handleFieldChange("Billing_Address_Line_2", e.target.value)
                    }
                  />
                  <div className="d-flex gap-2 mb-2">
                    <input
                      type="text"
                      className={inputClass}
                      placeholder="City / District"
                      value={formData.City}
                      onChange={(e) => handleFieldChange("City", e.target.value)}
                    />
                    <input
                      type="text"
                      className={inputClass}
                      placeholder="State / Province"
                      value={formData.State}
                      onChange={(e) => handleFieldChange("State", e.target.value)}
                    />
                  </div>
                  <div className="d-flex gap-2">
                    <input
                      type="text"
                      className={inputClass}
                      placeholder="Postal Code"
                      value={formData.Postal_Code}
                      onChange={(e) =>
                        handleFieldChange("Postal_Code", e.target.value)
                      }
                    />
                    <input
                      type="text"
                      className={inputClass}
                      placeholder="Country"
                      value={formData.Country}
                      onChange={(e) =>
                        handleFieldChange("Country", e.target.value)
                      }
                    />
                  </div>
                </StackField>
              </div>
            </div>
            <hr />
            <div>
              <div className="d-flex justify-content-between align-items-center mb-2">
                <h6 className="mb-0">Invoice Line Items</h6>
              </div>
              <div
                className="table-responsive border rounded position-relative"
                style={{ overflowX: "auto", overflowY: "visible" }}
              >
                <table
                  className="table table-sm align-middle mb-0"
                  style={{ minWidth: "1200px" }}
                >
                  <thead className="table-light">
                    <tr>
                      <th style={{ width: "60px" }}>Action</th>
                      <th>
                        <span className="text-danger">*</span> Service
                      </th>
                      <th>Description</th>
                      <th>Price</th>
                      <th>Discount (%)</th>
                      <th>Discount Amount</th>
                      <th>GST</th>
                      <th>GST Amount</th>
                      <th>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lineItems.map((item) => {
                      const price = Number(item.Price) || 0;
                      const discountPercent = Number(item.Discount) || 0;
                      const discountValue = (price * discountPercent) / 100;
                      const baseAmount = price - discountValue;
                      const gstAmount = Number(item.GST_Amount) || 0;
                      const gstType = item.GST_Type || "NA";
                      const lineAmount =
                        gstType === "Exclusive"
                          ? baseAmount + gstAmount
                          : baseAmount;
                      return (
                        <tr key={item.id}>
                          <td>
                            <button
                              type="button"
                              className="btn btn-link text-danger p-0"
                              onClick={() => removeLineItem(item.id)}
                              disabled={lineItems.length === 1}
                            >
                              ×
                            </button>
                          </td>
                          <td style={{ minWidth: "200px", position: "relative" }}>
                            <div
                              className="dropdown w-100"
                              ref={(el) => {
                                serviceDropdownRefs.current[item.id] = el;
                              }}
                            >
                              <button
                                type="button"
                                className="btn btn-outline-secondary w-100 d-flex justify-content-between align-items-center text-start"
                                style={{ whiteSpace: "normal", lineHeight: 1.2 }}
                                onClick={() => handleServiceDropdownToggle(item.id)}
                                aria-expanded={activeServiceDropdown === item.id}
                              >
                                <span className="flex-grow-1">
                                  {item.Service ? item.Service : "Select service"}
                                </span>
                                <span className="ms-2 text-muted flex-shrink-0">
                                  {activeServiceDropdown === item.id ? "▲" : "▼"}
                                </span>
                              </button>
                              {activeServiceDropdown === item.id && (
                                <>
                                  <div
                                    className="position-fixed top-0 start-0 w-100 h-100"
                                    style={{ zIndex: 19999 }}
                                    onClick={() => setActiveServiceDropdown(null)}
                                  ></div>
                                  <div
                                    className="dropdown-menu show p-3 border rounded shadow-sm"
                                    style={{
                                      display: "flex",
                                      flexDirection: "column",
                                      height: "300px",
                                      maxHeight: "300px",
                                      overflow: "hidden",
                                      width: "200px",
                                      ...(serviceDropdownStyle ?? {}),
                                    }}
                                  >
                                    <input
                                      type="text"
                                      className="form-control form-control-sm mb-2"
                                      placeholder="Search service"
                                      value={
                                        item.Service_Search ?? item.Service ?? ""
                                      }
                                      onChange={(e) =>
                                        handleServiceSearchChange(
                                          item.id,
                                          e.target.value
                                        )
                                      }
                                      autoFocus
                                    />
                                    <div
                                      style={{
                                        flex: 1,
                                        overflowY: "auto",
                                      }}
                                    >
                                      {(() => {
                                        const searchTerm =
                                          getServiceSearchTerm(item);
                                        const matches =
                                          getMatchingServices(searchTerm);
                                        if (matches.length === 0) {
                                          return (
                                            <div className="p-2 text-muted small">
                                              No matching services
                                            </div>
                                          );
                                        }
                                        return matches.map((service) => (
                                          <button
                                            type="button"
                                            key={service.__optionId}
                                            className="dropdown-item text-start text-wrap"
                                            style={{ whiteSpace: "normal" }}
                                            onMouseDown={(e) => {
                                              e.preventDefault();
                                              handleServiceSelect(item.id, service);
                                            }}
                                          >
                                            {service.__optionLabel}
                                          </button>
                                        ));
                                      })()}
                                    </div>
                                  </div>
                                </>
                              )}
                            </div>
                          </td>
                          <td style={{ minWidth: "200px" }}>
                            <input
                              type="text"
                              className="form-control"
                              value={item.Description}
                              onChange={(e) =>
                                handleLineItemChange(
                                  item.id,
                                  "Description",
                                  e.target.value
                                )
                              }
                            />
                          </td>
                          <td style={{ width: "140px" }}>
                            <input
                              type="number"
                              className="form-control"
                              value={item.Price}
                              onChange={(e) =>
                                handleLineItemChange(item.id, "Price", e.target.value)
                              }
                            />
                          </td>
                          <td style={{ width: "140px" }}>
                            <input
                              type="number"
                              className="form-control"
                              value={item.Discount}
                              onChange={(e) =>
                                handleLineItemChange(
                                  item.id,
                                  "Discount",
                                  e.target.value
                                )
                              }
                            />
                          </td>
                          <td style={{ width: "140px" }}>
                            <input
                              type="text"
                              className="form-control"
                              value={formatCurrency(discountValue)}
                              readOnly
                            />
                          </td>
                          <td style={{ width: "160px" }}>
                            <select
                              className="form-select"
                              value={item.GST_Type}
                              onChange={(e) =>
                                handleLineItemChange(
                                  item.id,
                                  "GST_Type",
                                  e.target.value
                                )
                              }
                            >
                              <option value="NA">NA</option>
                              <option value="Inclusive">Inclusive</option>
                              <option value="Exclusive">Exclusive</option>
                            </select>
                          </td>
                          <td style={{ width: "140px" }}>
                            <input
                              type="number"
                              className="form-control"
                              value={item.GST_Amount}
                              onChange={(e) =>
                                handleLineItemChange(
                                  item.id,
                                  "GST_Amount",
                                  e.target.value
                                )
                              }
                            />
                          </td>
                          <td style={{ width: "160px" }}>
                            <input
                              type="text"
                              className="form-control"
                              value={formatCurrency(lineAmount)}
                              readOnly
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="mt-2">
                <button
                  type="button"
                  className="btn btn-link p-0"
                  onClick={addLineItem}
                >
                  + Add New
                </button>
              </div>
            </div>
            <hr />
            <div className="invoice-summary-grid">
              <div className="invoice-summary-left">
                <InlineField label="Promo Code">
                  <input
                    type="text"
                    className={inputClass}
                    value={formData.Promo_Code}
                    onChange={(e) =>
                      handleFieldChange("Promo_Code", e.target.value)
                    }
                  />
                </InlineField>
                <InlineField label="Invoice Notes" alignTop>
                  <textarea
                    className={`${inputClass} invoice-notes`}
                    rows="3"
                    value={formData.Invoice_Notes}
                    onChange={(e) =>
                      handleFieldChange("Invoice_Notes", e.target.value)
                    }
                  />
                </InlineField>
              </div>
              <div className="invoice-summary-right">
                {summaryFields.map((field) => (
                  <div key={field.key} className="invoice-summary-field">
                    <label className="invoice-summary-label text-muted small">
                      {field.label}
                    </label>
                    <div className="invoice-summary-value">
                      <input
                        type="text"
                        className="form-control text-end"
                        value={formatCurrency(field.value)}
                        readOnly
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
              </>
            )}
          </div>
          <div className="modal-footer justify-content-end gap-2">
            <button
              type="button"
              className="btn btn-outline-secondary"
              onClick={handleReset}
            >
              {mode === "edit" ? "Reset Changes" : "Reset"}
            </button>
            <button type="button" className="btn btn-primary" onClick={handleSave}>
              {mode === "edit" ? "Update" : "Add"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default InvoiceCreateModal;
