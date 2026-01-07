import React from "react";
import { formatDateForInput } from "../utils/recordUtils";

function PaymentRequestFormFields({
  formData = {},
  onChange,
  agents = [],
  includeRequestId = false,
}) {
  const handleFieldChange = (field) => (event) => {
    if (typeof onChange === "function") {
      onChange(field, event.target.value);
    }
  };

  const agentOptions = Array.isArray(agents) ? agents : [];

  return (
    <>
      <div className="col-md-6">
        <label className="form-label">
          Request Date <span className="text-danger">*</span>
        </label>
        <input
          type="date"
          className="form-control"
          value={formatDateForInput(formData.Request_Date)}
          onChange={handleFieldChange("Request_Date")}
          required
        />
      </div>
      <div className="col-md-6">
        <label className="form-label">
          Requested Amount <span className="text-danger">*</span>
        </label>
        <input
          type="number"
          className="form-control"
          value={formData.Requested_Amount || ""}
          onChange={handleFieldChange("Requested_Amount")}
          required
        />
      </div>
      <div className="col-md-6">
        <label className="form-label">
          Requested Agent <span className="text-danger">*</span>
        </label>
        <select
          className="form-select"
          value={formData.Agent_ID || ""}
          onChange={handleFieldChange("Agent")}
          required
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
        <label className="form-label">Payee Location</label>
        <select
          className="form-select"
          value={formData.Payee_Location || "Australia"}
          onChange={handleFieldChange("Payee_Location")}
        >
          <option value="Australia">Australia</option>
          <option value="Outside Australia">Outside Australia</option>
        </select>
      </div>
      <div className="col-12">
        <label className="form-label">Request Note</label>
        <textarea
          rows="3"
          className="form-control"
          value={formData.Request_Note || ""}
          onChange={handleFieldChange("Request_Note")}
        />
      </div>
      {includeRequestId && (
        <div className="col-md-6">
          <label className="form-label">Payment Request ID</label>
          <input
            type="text"
            className="form-control"
            value={formData.Payment_Request_ID || ""}
            readOnly
          />
        </div>
      )}
    </>
  );
}

export default PaymentRequestFormFields;
