import React from "react";
import PaymentReceiptsTable from "./PaymentReceiptsTable";
import { formatCurrency, getStatusVariant } from "../utils/recordUtils";

function PaymentRequestsSection({
  paymentRequests = [],
  requestSearch,
  onSearchChange,
  onAddRequest,
  onUpdateRequest,
  onMarkReceived,
  expandedRequestId,
  onToggleRequest,
  expandedReceipts,
  expandedReceiptsTotal,
}) {
  const shownCount = paymentRequests.length;

  return (
    <section className="card shadow-sm border-0 mb-4">
      <div className="card-header d-flex flex-column flex-md-row gap-3 gap-md-0 align-items-md-center justify-content-between bg-white py-3">
        <div>
          <h2 className="h5 mb-1">Payment Requests</h2>
          <p className="text-muted small mb-0">
            Click a row to view its receipts, and use the action buttons to update.
          </p>
        </div>
        <div className="d-flex gap-2 align-items-center flex-wrap justify-content-end">
          <button
            type="button"
            className="btn btn-sm btn-primary"
            onClick={onAddRequest}
          >
            + Add Request
          </button>
          <input
            type="search"
            className="form-control form-control-sm"
            placeholder="Search requests..."
            value={requestSearch}
            onChange={(e) => onSearchChange(e.target.value)}
          />
          <span className="badge text-bg-secondary">{shownCount} shown</span>
        </div>
      </div>
      <div className="table-responsive">
        <table className="table table-hover align-middle mb-0">
          <thead className="table-light">
            <tr>
              <th>Req No</th>
              <th>Date</th>
              <th>Requested Amt</th>
              <th>Total Received</th>
              <th>Agent</th>
              <th>Status</th>
              <th className="text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            {paymentRequests.length > 0 ? (
              paymentRequests.map((request) => {
                const isExpanded = expandedRequestId === request.ID;
                const rowReceipts = isExpanded ? expandedReceipts : [];
                const rowReceiptsTotal = isExpanded ? expandedReceiptsTotal : 0;
          
                
                return (
                  <React.Fragment key={request.ID}>
                    <tr
                      onClick={() => onToggleRequest(request)}
                      style={{ cursor: "pointer" }}
                      className={isExpanded ? "table-active" : undefined}
                    >
                      <td className="fw-semibold">
                        {request.Payment_Request_ID}
                      </td>
                      <td>{request.Request_Date || "-"}</td>
                      <td>{formatCurrency(request.Requested_Amount)}</td>
                      <td>{formatCurrency(request.Received_Amount)}</td>
                      <td>
                        {request.Agent?.zc_display_value ||
                          request.Agent?.__optionLabel ||
                          request.Agent?.Name1?.zc_display_value ||
                          (request.Agent?.Name1
                            ? [
                                request.Agent.Name1.first_name,
                                request.Agent.Name1.last_name,
                              ]
                                .filter(Boolean)
                                .join(" ")
                            : "") ||
                          request.Agent?.Name1 ||
                          request.Agent?.User_Name ||
                          request.Agent?.user_name ||
                          request.Agent?.Login_Email_Address ||
                          "—"}
                      </td>
                      <td>
                        <span
                          className={`badge text-bg-${getStatusVariant(
                            request.Payment_Status
                          )}`}
                        >
                          {request.Payment_Status || "Unknown"}
                        </span>
                      </td>
                      <td>
                        <div className="d-flex gap-2 justify-content-center flex-wrap">
                          <button
                            className="btn btn-sm btn-outline-primary"
                            onClick={(e) => {
                              e.stopPropagation();
                              onUpdateRequest(request);
                            }}
                          >
                            Update
                          </button>
                          <button
                            className="btn btn-sm btn-outline-secondary"
                            onClick={(e) => {
                              e.stopPropagation();
                              alert("Email workflow placeholder");
                            }}
                          >
                            Email
                          </button>
                          <button
                            className="btn btn-sm btn-outline-success"
                            onClick={(e) => {
                              e.stopPropagation();
                              onMarkReceived(request);
                            }}
                          >
                            Mark Received
                          </button>
                        </div>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr className="bg-light">
                        <td colSpan="7">
                          <div className="p-3">
                            <div className="d-flex justify-content-between align-items-center mb-2">
                              <div>
                                <strong>Associated Payments</strong>
                                <span className="text-muted ms-2 small">
                                  {request.Payment_Request_ID || "Request"} · {" "}
                                  {rowReceipts.length} record
                                  {rowReceipts.length !== 1 && "s"}
                                </span>
                              </div>
                            </div>
                            <PaymentReceiptsTable
                              receipts={rowReceipts}
                              totalAmount={rowReceiptsTotal}
                            />
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })
            ) : (
              <tr>
                <td colSpan="7" className="text-center py-4 text-muted">
                  No Payment Requests Available
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default PaymentRequestsSection;
