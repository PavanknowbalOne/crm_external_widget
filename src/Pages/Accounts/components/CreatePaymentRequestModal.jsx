import React from "react";
import PaymentRequestFormFields from "./PaymentRequestFormFields";
function CreatePaymentRequestModal({
  isOpen,
  formData,
  onChange,
  onClose,
  onSave,
  isSaving,
  error,
  saveStatus,
  agents = [],
}) {
  if (!isOpen) {
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
              <h5 className="modal-title mb-0">Add Payment Request</h5>
              <p className="text-muted small mb-0">
                Provide the details and submit to create a new request.
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
                Payment request created successfully.
              </div>
            )}
            <form className="row g-3">
              <PaymentRequestFormFields
                formData={formData}
                onChange={onChange}
                agents={agents}
              />
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
              {isSaving ? "Creating..." : "Create Request"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CreatePaymentRequestModal;
