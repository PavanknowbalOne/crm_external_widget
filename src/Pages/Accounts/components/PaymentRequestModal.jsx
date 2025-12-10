import React from "react";
import PaymentReceiptsTable from "./PaymentReceiptsTable";
import PaymentRequestFormFields from "./PaymentRequestFormFields";

function PaymentRequestModal({
  isOpen,
  selectedRequest,
  formData,
  onChange,
  onClose,
  onSave,
  isLoading,
  isSaving,
  error,
  saveStatus,
  relatedReceipts,
  relatedReceiptsTotal,
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
              <h5 className="modal-title mb-0">
                Payment Request #{selectedRequest?.Payment_Request_ID || ""}
              </h5>
              <p className="text-muted small mb-0">
                Review or edit payment request details.
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
                <span>Loading request details…</span>
              </div>
            ) : formData ? (
              <>
                {error && (
                  <div className="alert alert-danger mb-3" role="alert">
                    {error}
                  </div>
                )}
                {saveStatus === "success" && (
                  <div className="alert alert-success mb-3" role="alert">
                    Payment request updated successfully.
                  </div>
                )}
                <form className="row g-3">
                  <PaymentRequestFormFields
                    formData={formData}
                    onChange={onChange}
                    agents={agents}
                    includeRequestId
                  />
                </form>
                <div className="mt-4">
                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <h6 className="mb-0">Associated Payments</h6>
                    <span className="badge text-bg-light">
                      {relatedReceipts.length} records
                    </span>
                  </div>
                  <PaymentReceiptsTable
                    receipts={relatedReceipts}
                    totalAmount={relatedReceiptsTotal}
                  />
                </div>
              </>
            ) : error ? (
              <div className="alert alert-danger mb-0" role="alert">
                {error}
              </div>
            ) : (
              <p className="text-muted mb-0">No request data available.</p>
            )}
          </div>
          <div className="modal-footer">
            <button
              type="button"
              className="btn btn-outline-secondary"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={onSave}
              disabled={isSaving}
            >
              {isSaving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PaymentRequestModal;
