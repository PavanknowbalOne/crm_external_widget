import React from "react";
import { formatDateForInput } from "../../Accounts/utils/recordUtils";

function InvoiceDetailsModal({
  isOpen,
  invoice,
  formData,
  isLoading,
  error,
  onClose,
  onChange,
}) {
  if (!isOpen) {
    return null;
  }

  const handleInput = (field) => (event) => {
    if (typeof onChange === "function") {
      onChange(field, event.target.value);
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
        className="modal-dialog modal-lg modal-dialog-centered"
        role="document"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-content shadow-lg border-0">
          <div className="modal-header">
            <div>
              <h5 className="modal-title mb-0">
                Invoice #{invoice?.Invoice_Number || ""}
              </h5>
              <p className="text-muted small mb-0">
                Review or edit invoice details.
              </p>
            </div>
            <button type="button" className="btn-close" onClick={onClose}></button>
          </div>
          <div className="modal-body">
            {isLoading ? (
              <div className="d-flex align-items-center gap-2">
                <div className="spinner-border text-primary" role="status">
                  <span className="visually-hidden">Loading...</span>
                </div>
                <span>Loading invoice details…</span>
              </div>
            ) : error ? (
              <div className="alert alert-danger mb-0" role="alert">
                {error}
              </div>
            ) : formData ? (
              <form className="row g-3">
                <div className="col-md-6">
                  <label className="form-label">Invoice Date</label>
                  <input
                    type="date"
                    className="form-control"
                    value={formatDateForInput(formData.Invoice_Date)}
                    onChange={handleInput("Invoice_Date")}
                  />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Invoice Number</label>
                  <input
                    type="text"
                    className="form-control"
                    value={formData.Invoice_Number || ""}
                    readOnly
                  />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Agent</label>
                  <input
                    type="text"
                    className="form-control"
                    value={formData.Agent?.zc_display_value || "—"}
                    readOnly
                  />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Email</label>
                  <input
                    type="email"
                    className="form-control"
                    value={formData.Email || ""}
                    onChange={handleInput("Email")}
                  />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Phone</label>
                  <input
                    type="text"
                    className="form-control"
                    value={formData.Phone || ""}
                    onChange={handleInput("Phone")}
                  />
                </div>
                <div className="col-12">
                  <label className="form-label">Billing Address</label>
                  <textarea
                    className="form-control"
                    rows="3"
                    value={
                      `${formData.Billing_Address_Line_1 || ""}\n${
                        formData.Billing_Address_Line_2 || ""
                      }`.trim() || ""
                    }
                    readOnly
                  />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Promo Code</label>
                  <input
                    type="text"
                    className="form-control"
                    value={formData.Promo_Code || ""}
                    onChange={handleInput("Promo_Code")}
                  />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Invoice Notes</label>
                  <textarea
                    className="form-control"
                    rows="2"
                    value={formData.Invoice_Notes || ""}
                    onChange={handleInput("Invoice_Notes")}
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
              onClick={onClose}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default InvoiceDetailsModal;
