import React from "react";
import InvoiceUtilizationsPanel from "./InvoiceUtilizationsPanel";

const InvoiceListCard = ({
  invoiceSearch,
  onSearchChange,
  filteredInvoices,
  isLoading,
  error,
  formatCurrency,
  onAddInvoice,
  onUpdateInvoice,
  onViewUtilizations = () => {},
  isUtilizationLoading = false,
  selectedUtilizationInvoice = null,
  selectedUtilizations = [],
  utilizationError = null,
  onRefreshUtilizations = () => {},
  onClearUtilizations = () => {},
  onUtilizeInvoice = () => {},
}) => {
  const invoiceMatchesSelection = (invoice) => {
    if (!invoice || !selectedUtilizationInvoice) {
      return false;
    }
    const invoiceId =
      invoice.ID ??
      invoice.Invoice ??
      invoice.Invoice_Number ??
      invoice.invoiceId ??
      null;
    const selectedId =
      selectedUtilizationInvoice.ID ??
      selectedUtilizationInvoice.Invoice ??
      selectedUtilizationInvoice.Invoice_Number ??
      null;
    if (invoiceId === null || invoiceId === undefined) {
      return false;
    }
    if (selectedId === null || selectedId === undefined) {
      return false;
    }
    return String(invoiceId) === String(selectedId);
  };

  const getInvoiceLabel = (invoice) =>
    invoice.Invoice_Number ||
    invoice.Invoice?.zc_display_value ||
    invoice.Name ||
    `Invoice ${invoice.ID || ""}`.trim();

  const handleRowClick = (invoice) => {
    onViewUtilizations(invoice);
  };

  const renderUtilizationRow = (invoiceLabel) => (
    <tr>
      <td colSpan="7" className="bg-light">
        <div className="d-flex flex-column flex-lg-row gap-2 justify-content-between align-items-lg-center mb-3">
          <div className="fw-semibold">
            Payment utilizations for {invoiceLabel}
          </div>
          <div className="d-flex gap-2">
            <button
              type="button"
              className="btn btn-sm btn-outline-secondary"
              onClick={(e) => {
                e.stopPropagation();
                onRefreshUtilizations();
              }}
              disabled={isUtilizationLoading}
            >
              Refresh
            </button>
            <button
              type="button"
              className="btn btn-sm btn-outline-dark"
              onClick={(e) => {
                e.stopPropagation();
                onClearUtilizations();
              }}
            >
              Hide
            </button>
          </div>
        </div>
        <InvoiceUtilizationsPanel
          utilizations={selectedUtilizations}
          isLoading={isUtilizationLoading}
          error={utilizationError}
          formatCurrency={formatCurrency}
          emptyMessage="No utilizations found for this invoice."
        />
      </td>
    </tr>
  );

  return (
    <section className="card shadow-sm border-0">
      <div className="card-header d-flex flex-column flex-md-row gap-3 gap-md-0 align-items-md-center justify-content-between bg-white py-3">
        <div>
          <h2 className="h5 mb-1">All Invoices</h2>
          <p className="text-muted small mb-0">
            Filter invoices or trigger follow-up actions.
          </p>
        </div>
        <div className="d-flex gap-2 align-items-center flex-wrap">
          <input
            type="search"
            className="form-control form-control-sm"
            placeholder="Search invoices..."
            value={invoiceSearch}
            onChange={(e) => onSearchChange(e.target.value)}
          />
          <button
            type="button"
            className="btn btn-sm btn-primary text-white"
            onClick={onAddInvoice}
          >
            + Add Invoice
          </button>
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
                    <div className="spinner-border text-primary" role="status">
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
              filteredInvoices.map((invoice, index) => {
                const isActive = invoiceMatchesSelection(invoice);
                const rowKey =
                  invoice.ID ||
                  invoice.Invoice ||
                  invoice.Invoice_Number ||
                  `invoice-${index}`;
                const invoiceLabel = getInvoiceLabel(invoice);
                return (
                  <React.Fragment key={rowKey}>
                    <tr
                      className={isActive ? "table-active" : ""}
                      style={{ cursor: "pointer" }}
                      onClick={() => handleRowClick(invoice)}
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
                            className="btn btn-sm btn-outline-primary"
                            onClick={(e) => {
                              e.stopPropagation();
                              onUpdateInvoice(invoice);
                            }}
                          >
                            Update
                          </button>
                          <button
                            className="btn btn-sm btn-outline-success"
                            onClick={(e) => {
                              e.stopPropagation();
                              onUtilizeInvoice(invoice);
                            }}
                          >
                            Utilize
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
                    {isActive && renderUtilizationRow(invoiceLabel)}
                  </React.Fragment>
                );
              })
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
  );
};

export default InvoiceListCard;
