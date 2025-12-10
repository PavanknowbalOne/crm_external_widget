import React from "react";
import { formatDateForInput } from "../utils/recordUtils";

function PaymentReceiptModal({
  isOpen,
  formData,
  onChange,
  onClose,
  onSave,
  isSaving,
  error,
  saveStatus,
}) {
  if (!isOpen || !formData) {
    return null;
  }

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
              <h5 className="modal-title mb-0">Record Payment Received</h5>
              <p className="text-muted small mb-0">
                Log funds received for request #{formData.Payment_Request_ID || ""}.
              </p>
            </div>
            <button type="button" className="btn-close" onClick={onClose}></button>
          </div>
          <div className="modal-body">
            {error && (
              <div className="alert alert-danger" role="alert">
                {error}
              </div>
            )}
            {saveStatus === "success" && (
              <div className="alert alert-success" role="alert">
                Payment receipt saved successfully.
              </div>
            )}
            <form className="row g-3">
              <div className="col-md-6">
                <label className="form-label">Received Date</label>
                <input
                  type="date"
                  className="form-control"
                  value={formatDateForInput(formData.Received_Date)}
                  onChange={(e) => onChange("Received_Date", e.target.value)}
                />
              </div>
              <div className="col-md-6">
                <label className="form-label">Received Amount</label>
                <input
                  type="number"
                  className="form-control"
                  value={formData.Received_Amount || ""}
                  onChange={(e) => onChange("Received_Amount", e.target.value)}
                />
              </div>
              <div className="col-md-6">
                <label className="form-label">Payment Mode</label>
                <select
                  className="form-select"
                  value={formData.Payment_Mode || ""}
                  onChange={(e) => onChange("Payment_Mode", e.target.value)}
                >
                  <option value="">Select payment mode</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                  <option value="Stripe">Stripe</option>
                  <option value="Payment Gateway">Payment Gateway</option>
                  <option value="Cash">Cash</option>
                </select>
              </div>
              <div className="col-12">
                <label className="form-label">Notes</label>
                {/* <input
                  type="text"
                  className="form-control"
                  value={formData.Payment_Reference || ""}
                  onChange={(e) => onChange("Payment_Reference", e.target.value)}
                /> */}
                 <textarea
                  className="form-control"
                  rows="4" 
                  value={formData.Payment_Reference || ""}
                  onChange={(e) => onChange("Payment_Reference", e.target.value)}
                />
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
              className="btn btn-success"
              onClick={onSave}
              disabled={isSaving}
            >
              {isSaving ? "Recording..." : "Record Payment"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PaymentReceiptModal;
