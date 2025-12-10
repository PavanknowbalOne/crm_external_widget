import React, { useEffect, useMemo, useRef, useState } from "react";

function Invoices() {
  const [invoices, setInvoices] = useState([]);
  const [invoiceSearch, setInvoiceSearch] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isInvoiceModalOpen, setInvoiceModalOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [invoiceFormData, setInvoiceFormData] = useState(null);
  const [isInvoiceDetailLoading, setIsInvoiceDetailLoading] = useState(false);
  const [invoiceDetailError, setInvoiceDetailError] = useState(null);
  const [viewportHeight, setViewportHeight] = useState(window.innerHeight);
  const [viewportWidth, setViewportWidth] = useState(window.innerWidth);
  const zohoInitPromiseRef = useRef(null);

  const INVOICE_REPORT_NAME = "All_Invoices";

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

  const ensureZohoReady = async () => {
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

  useEffect(() => {
    const fetchInvoices = async () => {
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
        setInvoices(response?.data ?? []);
      } catch (err) {
        setError(err.message || "Unable to fetch invoices.");
        setInvoices([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchInvoices();

    const handleResize = () => {
      setViewportHeight(window.innerHeight);
      setViewportWidth(window.innerWidth);
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

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

  const fetchInvoiceDetails = async (invoiceId) => {
    if (!invoiceId) return;
    setInvoiceModalOpen(true);
    setIsInvoiceDetailLoading(true);
    setInvoiceDetailError(null);
    try {
      const creator = await ensureZohoReady();
      const dataModule = getCreatorModule(creator, "DATA");
      if (!dataModule?.getRecords) {
        throw new Error("Zoho DATA.getRecords API unavailable.");
      }
      const response = await dataModule.getRecords({
        report_name: INVOICE_REPORT_NAME,
        criteria: `(Invoice_Number == "${invoiceId}")`,
        page: 1,
      });
      const record = response?.data?.[0];
      if (!record) {
        setSelectedInvoice(null);
        setInvoiceFormData(null);
        setInvoiceDetailError("Invoice not found.");
        return;
      }
      setSelectedInvoice(record);
      setInvoiceFormData({ ...record });
    } catch (detailErr) {
      setSelectedInvoice(null);
      setInvoiceFormData(null);
      setInvoiceDetailError(detailErr.message || "Unable to fetch invoice.");
    } finally {
      setIsInvoiceDetailLoading(false);
    }
  };

  const handleInvoiceRowClick = (invoice) => {
    if (!invoice?.Invoice_Number) return;
    fetchInvoiceDetails(invoice.Invoice_Number);
  };

  const handleInvoiceInputChange = (field, value) => {
    setInvoiceFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const closeInvoiceModal = () => {
    setInvoiceModalOpen(false);
    setSelectedInvoice(null);
    setInvoiceFormData(null);
    setInvoiceDetailError(null);
    setIsInvoiceDetailLoading(false);
  };

  return (
    <div className="container pb-5">
      <header className="d-flex flex-column flex-md-row justify-content-between align-items-md-center mb-4">
        <div>
          <p className="text-uppercase text-muted mb-1">Invoice Center</p>
          <h1 className="h3 fw-bold mb-2">Invoices Dashboard</h1>
          <p className="text-muted mb-0">
            Track invoice totals and follow up with clients quickly.
          </p>
        </div>
        <div className="text-md-end mt-3 mt-md-0">
          <p className="text-muted mb-1">Viewport</p>
          <span className="badge text-bg-light">
            {viewportWidth} × {viewportHeight}
          </span>
        </div>
      </header>

      <section className="card shadow-sm border-0">
        <div className="card-header d-flex flex-column flex-md-row gap-3 gap-md-0 align-items-md-center justify-content-between bg-white py-3">
          <div>
            <h2 className="h5 mb-1">All Invoices</h2>
            <p className="text-muted small mb-0">
              Filter invoices or trigger follow-up actions.
            </p>
          </div>
          <div className="d-flex gap-2 align-items-center">
            <input
              type="search"
              className="form-control form-control-sm"
              placeholder="Search invoices..."
              value={invoiceSearch}
              onChange={(e) => setInvoiceSearch(e.target.value)}
            />
            <span className="badge text-bg-secondary">
              {filteredInvoices.length} shown
            </span>
          </div>
        </div>
        <div className="table-responsive">
          <table className="table table-striped align-middle mb-0">
            <thead className="table-light">
              <tr>
                <th>Invoice #</th>
                <th>Date</th>
                <th>Agent</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Total Amount</th>
                <th className="text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan="7" className="text-center py-4">
                    <div className="d-inline-flex align-items-center gap-2">
                      <div
                        className="spinner-border text-primary"
                        role="status"
                      >
                        <span className="visually-hidden">Loading...</span>
                      </div>
                      <span>Fetching invoices…</span>
                    </div>
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan="7" className="text-center py-4">
                    <div className="alert alert-danger mb-0" role="alert">
                      {error}
                    </div>
                  </td>
                </tr>
              ) : filteredInvoices && filteredInvoices.length > 0 ? (
                filteredInvoices.map((invoice) => (
                  <tr
                    key={invoice.ID}
                    onClick={() => handleInvoiceRowClick(invoice)}
                    style={{ cursor: "pointer" }}
                  >
                    <td className="fw-semibold">{invoice.Invoice_Number}</td>
                    <td>{invoice.Invoice_Date || "-"}</td>
                    <td>{invoice.Agent?.zc_display_value || "—"}</td>
                    <td>{invoice.Email || "—"}</td>
                    <td>{invoice.Phone || "—"}</td>
                    <td>{formatCurrency(invoice.Total_Amount)}</td>
                    <td className="text-center">
                      <div className="d-flex justify-content-center gap-2">
                        <button
                          className="btn btn-sm btn-outline-secondary"
                          onClick={(e) => {
                            e.stopPropagation();
                            alert("Utilize payment placeholder");
                          }}
                        >
                          Utilize Payment
                        </button>
                        <button
                          className="btn btn-sm btn-primary text-white"
                          onClick={(e) => {
                            e.stopPropagation();
                            alert("Send invoice placeholder");
                          }}
                        >
                          Send Invoice
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="7" className="text-center py-4 text-muted">
                    No Invoices Available
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {isInvoiceModalOpen && (
        <div
          className="modal fade show d-block"
          tabIndex="-1"
          role="dialog"
          style={{ backgroundColor: "rgba(0,0,0,0.4)" }}
          onClick={closeInvoiceModal}
        >
          <div
            className="modal-dialog modal-lg modal-dialog-centered"
            role="document"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-content shadow-lg border-0">
              <div className="modal-header">
                <div>
                  <h5 className="modal-title mb-0">
                    Invoice #{selectedInvoice?.Invoice_Number || ""}
                  </h5>
                  <p className="text-muted small mb-0">
                    Review or edit invoice details.
                  </p>
                </div>
                <button
                  type="button"
                  className="btn-close"
                  onClick={closeInvoiceModal}
                ></button>
              </div>
              <div className="modal-body">
                {isInvoiceDetailLoading ? (
                  <div className="d-flex align-items-center gap-2">
                    <div className="spinner-border text-primary" role="status">
                      <span className="visually-hidden">Loading...</span>
                    </div>
                    <span>Loading invoice details…</span>
                  </div>
                ) : invoiceDetailError ? (
                  <div className="alert alert-danger mb-0" role="alert">
                    {invoiceDetailError}
                  </div>
                ) : invoiceFormData ? (
                  <form className="row g-3">
                    <div className="col-md-6">
                      <label className="form-label">Invoice Date</label>
                      <input
                        type="text"
                        className="form-control"
                        value={invoiceFormData.Invoice_Date || ""}
                        onChange={(e) =>
                          handleInvoiceInputChange(
                            "Invoice_Date",
                            e.target.value
                          )
                        }
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">Invoice Number</label>
                      <input
                        type="text"
                        className="form-control"
                        value={invoiceFormData.Invoice_Number || ""}
                        readOnly
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">Agent</label>
                      <input
                        type="text"
                        className="form-control"
                        value={
                          invoiceFormData.Agent?.zc_display_value || ""
                        }
                        readOnly
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">Email</label>
                      <input
                        type="email"
                        className="form-control"
                        value={invoiceFormData.Email || ""}
                        onChange={(e) =>
                          handleInvoiceInputChange("Email", e.target.value)
                        }
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">Phone</label>
                      <input
                        type="text"
                        className="form-control"
                        value={invoiceFormData.Phone || ""}
                        onChange={(e) =>
                          handleInvoiceInputChange("Phone", e.target.value)
                        }
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">Total Amount</label>
                      <input
                        type="number"
                        className="form-control"
                        value={invoiceFormData.Total_Amount || ""}
                        onChange={(e) =>
                          handleInvoiceInputChange(
                            "Total_Amount",
                            e.target.value
                          )
                        }
                      />
                    </div>
                    <div className="col-12">
                      <label className="form-label">Notes</label>
                      <textarea
                        rows="3"
                        className="form-control"
                        value={invoiceFormData.Invoice_Notes || ""}
                        onChange={(e) =>
                          handleInvoiceInputChange(
                            "Invoice_Notes",
                            e.target.value
                          )
                        }
                      />
                    </div>
                  </form>
                ) : (
                  <p className="text-muted mb-0">No invoice data available.</p>
                )}
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  onClick={closeInvoiceModal}
                >
                  Cancel
                </button>
                <button type="button" className="btn btn-primary">
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Invoices;
