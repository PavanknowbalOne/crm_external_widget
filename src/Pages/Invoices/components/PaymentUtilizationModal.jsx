import React from "react";

const PaymentUtilizationModal = ({
  isOpen,
  invoice,
  formData,
  agentOptions = [],
  paymentReceiptOptions = [],
  isReceiptLoading = false,
  isSaving = false,
  error = null,
  onFieldChange,
  onClose,
  onSave,
  uploadFile = null,
  onFileChange = () => {},
}) => {
  if (!isOpen || !formData) {
    return null;
  }

  const handleBackdropClick = (event) => {
    if (event.target === event.currentTarget) {
      onClose();
    }
  };

  console.log("7777" + JSON.stringify(paymentReceiptOptions));
  
  const invoiceLabel =
    formData.Invoice_Number_Label ||
    invoice?.Invoice_Number ||
    invoice?.Invoice?.zc_display_value ||
    "";

  const clientLabel =
    formData.Client ||
    invoice?.Client?.Client_ID ||
    invoice?.Client?.zc_display_value ||
    invoice?.Billing_Name ||
    "";

  return (
    <div
      className="modal fade show d-block"
      tabIndex="-1"
      role="dialog"
      style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
      onClick={handleBackdropClick}
    >
      <div
        className="modal-dialog modal-xl modal-dialog-centered"
        role="document"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-content border-0 shadow-lg">
          <div className="modal-header">
            <div>
              <h5 className="modal-title mb-0">Payment Utilization</h5>
              <p className="text-muted small mb-0">
                Apply received funds to invoice {invoiceLabel || "—"}
              </p>
            </div>
            <button
              type="button"
              className="btn-close"
              onClick={onClose}
              disabled={isSaving}
            />
          </div>
          <div className="modal-body">
            {error && (
              <div className="alert alert-danger" role="alert">
                {error}
              </div>
            )}
            <form className="row g-3">
              <div className="col-md-6">
                <label className="form-label">Client ID</label>
                <input
                  type="text"
                  className="form-control"
                  value={formData.Client || clientLabel || ""}
                  onChange={(e) => onFieldChange("Client", e.target.value)}
                  placeholder="Enter client identifier"
                  disabled
                />
              </div>
              <div className="col-md-6">
                <label className="form-label">Invoice Number</label>
                <input
                  type="text"
                  className="form-control"
                  value={invoiceLabel}
                  disabled
                />
              </div>
              <div className="col-md-6">
                <label className="form-label d-flex align-items-center gap-2">
                  Payment Received <span className="text-danger">*</span>
                  {isReceiptLoading && (
                    <span
                      className="spinner-border spinner-border-sm text-secondary"
                      role="status"
                    >
                      <span className="visually-hidden">Loading…</span>
                    </span>
                  )}
                </label>
                <select
                  className="form-select"
                  value={formData.Payment_Received || ""}
                  onChange={(e) =>
                    onFieldChange("Payment_Received", e.target.value)
                  }
                  disabled={isSaving || isReceiptLoading}
                >
                  <option value="">Select payment receipt</option>
                  {paymentReceiptOptions.map((receipt) => (
                    <option key={receipt.value} value={receipt.value}>
                      {receipt.label} - {receipt.amount}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-md-6">
                <label className="form-label">Total Received Amount</label>
                <div className="input-group">
                  <span className="input-group-text">$</span>
                  <input
                    type="number"
                    className="form-control"
                    value={formData.Received_Amount || ""}
                    onChange={(e) =>
                      onFieldChange("Received_Amount", e.target.value)
                    }
                    step="0.01"
                    min="0"
                    disabled
                  />
                </div>
              </div>
              <div className="col-md-6">
                <label className="form-label">
                  Utilization Agent <span className="text-danger">*</span>
                </label>
                <select
                  className="form-select"
                  value={formData.Utilization_Agent || ""}
                  onChange={(e) =>
                    onFieldChange("Utilization_Agent", e.target.value)
                  }
                  disabled={isSaving}
                >
                  <option value="">Select agent</option>
                  {agentOptions.map((agent) => (
                    <option key={agent.__optionId} value={agent.__optionId}>
                      {agent.__optionLabel}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-md-6">
                <label className="form-label">
                  Utilization <span className="text-danger">*</span>
                </label>
                <div className="input-group">
                  <span className="input-group-text">$</span>
                  <input
                    type="number"
                    className="form-control"
                    value={formData.Utilization || ""}
                    onChange={(e) =>
                      onFieldChange("Utilization", e.target.value)
                    }
                    step="0.01"
                    min="0"
                    disabled={isSaving}
                  />
                </div>
              </div>
              <div className="col-md-6">
                <label className="form-label">Total Utilized Amount</label>
                <div className="input-group">
                  <span className="input-group-text">$</span>
                  <input
                    type="number"
                    className="form-control"
                    value={formData.Total_Utilized_Amount || ""}
                    readOnly
                    disabled
                  />
                </div>
              </div>
              <div className="col-md-6">
                <label className="form-label">Utilization Date</label>
                <input
                  type="date"
                  className="form-control"
                  value={formData.Receipt_Date || ""}
                  onChange={(e) =>
                    onFieldChange("Receipt_Date", e.target.value)
                  }
                  disabled={isSaving}
                />
              </div>
              <div className="col-12">
                <label className="form-label">Utilization Note</label>
                <textarea
                  className="form-control"
                  rows="3"
                  value={formData.Utilization_Note || ""}
                  onChange={(e) =>
                    onFieldChange("Utilization_Note", e.target.value)
                  }
                  disabled={isSaving}
                />
              </div>
              <div className="col-12">
                <label className="form-label">Upload File</label>
                <input
                  type="file"
                  className="form-control"
                  onChange={(e) => onFileChange(e.target.files?.[0] || null)}
                  disabled={isSaving}
                />
                {uploadFile ? (
                  <div className="d-flex align-items-center justify-content-between mt-2">
                    <small className="text-muted">
                      Selected: {uploadFile.name} ({Math.round(uploadFile.size / 1024)} KB)
                    </small>
                    <button
                      type="button"
                      className="btn btn-sm btn-link text-decoration-none"
                      onClick={() => onFileChange(null)}
                      disabled={isSaving}
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <small className="text-muted">
                    Attach images or supporting files for this utilization entry.
                  </small>
                )}
              </div>
            </form>
          </div>
          <div className="modal-footer">
            <button
              type="button"
              className="btn btn-outline-secondary"
              onClick={onClose}
              disabled={isSaving}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={onSave}
              disabled={isSaving}
            >
              {isSaving ? "Saving..." : "Submit"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaymentUtilizationModal;
