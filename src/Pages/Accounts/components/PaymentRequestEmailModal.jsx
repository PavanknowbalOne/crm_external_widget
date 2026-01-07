import React, { useEffect, useRef, useState } from "react";

function PaymentRequestEmailModal({
  isOpen = false,
  formData = {},
  agentOptions = [],
  emailTemplates = [],
  placeholderValues = {},
  onChange = () => {},
  onClose = () => {},
  onSend = () => {},
  isSending = false,
  error = null,
}) {
  const contentRef = useRef(null);
  const [ccEntries, setCcEntries] = useState([""]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    if (contentRef.current) {
      const nextValue =
        formData.Content ?? formData.Email_Content ?? "";
      if (contentRef.current.innerHTML !== nextValue) {
        contentRef.current.innerHTML = nextValue;
      }
    }
  }, [formData.Content, formData.Email_Content, isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const parsed = (formData.CC || "")
      .split(/[,;\n]/)
      .map((entry) => entry.trim())
      .filter(Boolean);
    setCcEntries(parsed.length ? parsed : [""]);
  }, [formData.CC, isOpen]);

  if (!isOpen) {
    return null;
  }

  const handleFieldChange = (field) => (event) => {
    const value = event?.target?.value ?? "";
    onChange(field, value);
  };

  const handleCcChange = (index) => (event) => {
    const value = event?.target?.value ?? "";
    setCcEntries((prev) => {
      const next = [...prev];
      next[index] = value;
      onChange(
        "CC",
        next
          .map((entry) => entry.trim())
          .filter(Boolean)
          .join(", ")
      );
      return next;
    });
  };

  const handleAddCc = () => {
    setCcEntries((prev) => [...prev, ""]);
  };

  const handleRemoveCc = (index) => {
    setCcEntries((prev) => {
      if (prev.length <= 1) {
        onChange("CC", "");
        return [""];
      }
      const next = prev.filter((_, i) => i !== index);
      onChange(
        "CC",
        next
          .map((entry) => entry.trim())
          .filter(Boolean)
          .join(", ")
      );
      return next.length ? next : [""];
    });
  };

  const safeAgentOptions = Array.isArray(agentOptions) ? agentOptions : [];
  const safeTemplates = Array.isArray(emailTemplates) ? emailTemplates : [];

  const applyPlaceholders = (text = "") => {
    if (!text) return text;
    let output = text;
    const replacements = {
      NAME: placeholderValues?.NAME,
      SERVICE:
        placeholderValues?.SERVICE ?? placeholderValues?.Service ?? "",
    };
    if (replacements.NAME !== undefined) {
      output = output.replace(/\{NAME\}/gi, replacements.NAME || "");
    }
    if (replacements.SERVICE !== undefined) {
      output = output.replace(
        /\{SERVICE\}/gi,
        replacements.SERVICE || ""
      );
    }
    return output;
  };

  const handleTemplateChange = (event) => {
    const templateId = event.target.value;
    onChange("TemplateId", templateId);
    if (!templateId) {
      return;
    }
    const templateMatch = safeTemplates.find((template) => {
      const identifiers = [
        template.ID,
        template.id,
        template.Template_ID,
        template.Templateid,
      ]
        .filter((candidate) => candidate !== undefined && candidate !== null)
        .map((candidate) => String(candidate));
      return identifiers.includes(templateId);
    });
    if (!templateMatch) {
      return;
    }
    const templateSubject =
      templateMatch.Subject ||
      templateMatch.Template_Subject ||
      templateMatch.Subject_field ||
      templateMatch.Template_Name ||
      "";
    const templateContent =
      templateMatch.Email_Content ||
      templateMatch.Template_Content ||
      templateMatch.Template_Body ||
      "";
    const appliedSubject = applyPlaceholders(templateSubject || "");
    if (appliedSubject) {
      onChange("Subject", appliedSubject);
    }
    const appliedContent = applyPlaceholders(templateContent || "");
    if (appliedContent) {
      onChange("Content", appliedContent);
      if (contentRef.current) {
        contentRef.current.innerHTML = appliedContent;
      }
    }
  };

  const handleContentInput = (event) => {
    onChange("Content", event.currentTarget.innerHTML);
  };

  const handleToolbarAction = (command, value = null) => {
    if (!contentRef.current) return;
    if (command === "createLink") {
      const url = value || window.prompt("Enter link URL");
      if (!url) {
        return;
      }
      document.execCommand(command, false, url);
    } else if (command === "formatBlock") {
      document.execCommand(command, false, value);
    } else {
      document.execCommand(command, false, value);
    }
    contentRef.current.focus();
  };

  return (
    <div
      className="modal fade show d-block"
      tabIndex="-1"
      role="dialog"
      style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
      onClick={onClose}
    >
      <div
        className="modal-dialog modal-lg modal-dialog-centered"
        role="document"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-content border-0 shadow-lg">
          <div className="modal-header">
            <div>
              <h5 className="modal-title mb-0">Send Email</h5>
              <p className="text-muted small mb-0">
                Notify the client about this payment request.
              </p>
            </div>
            <button
              type="button"
              className="btn-close"
              onClick={onClose}
              disabled={isSending}
            />
          </div>
          <div className="modal-body">
            {error && (
              <div className="alert alert-danger py-2" role="alert">
                {error}
              </div>
            )}
            <form className="row g-3">
              <div className="col-md-12">
                <label className="form-label">Email Template</label>
                <select
                  className="form-select form-select-sm"
                  value={formData.TemplateId || ""}
                  onChange={handleTemplateChange}
                  disabled={isSending || !safeTemplates.length}
                >
                  <option value="">
                    {safeTemplates.length
                      ? "Select template"
                      : "No templates available"}
                  </option>
                  {safeTemplates.map((template) => (
                    <option
                      key={template.ID || template.id || template.Template_ID}
                      value={
                        template.ID ||
                        template.id ||
                        template.Template_ID ||
                        template.Templateid ||
                        ""
                      }
                    >
                      {template.Template_Name ||
                        template.Template ||
                        template.Subject ||
                        template.Name ||
                        "Template"}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-md-6">
                <label className="form-label">Assigned User</label>
                <select
                  className="form-select form-select-sm"
                  value={formData.Assigned_User || ""}
                  onChange={handleFieldChange("Assigned_User")}
                  disabled={isSending}
                >
                  <option value="">Select user</option>
                  {safeAgentOptions.map((agent) => (
                    <option key={agent.__optionId} value={agent.__optionId}>
                      {agent.__optionLabel}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-md-6">
                <label className="form-label">Client</label>
                <input
                  type="text"
                  className="form-control form-control-sm"
                  value={formData.Client_Name || ""}
                  onChange={handleFieldChange("Client_Name")}
                  disabled={isSending}
                />
              </div>
              <div className="col-md-6">
                <label className="form-label">
                  From <span className="text-danger">*</span>
                </label>
                <input
                  type="email"
                  className="form-control form-control-sm"
                  value={formData.From || ""}
                  onChange={handleFieldChange("From")}
                  // readOnly
                  // disabled
                  required
                />
              </div>
              <div className="col-md-6">
                <label className="form-label">
                  To <span className="text-danger">*</span>
                </label>
                <input
                  type="email"
                  className="form-control form-control-sm"
                  value={formData.To || ""}
                  onChange={handleFieldChange("To")}
                  // readOnly
                  // disabled
                  required
                />
              </div>
              <div className="col-md-12">
                <label className="form-label">Subject</label>
                <input
                  type="text"
                  className="form-control form-control-sm"
                  value={formData.Subject || ""}
                  onChange={handleFieldChange("Subject")}
                  disabled={isSending}
                />
              </div>
              <div className="col-12">
                <label className="form-label">
                  Content <span className="text-danger">*</span>
                </label>
                <div className="d-flex flex-wrap gap-1 mb-2">
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-secondary"
                    onClick={() => handleToolbarAction("bold")}
                    disabled={isSending}
                  >
                    <strong>B</strong>
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-secondary"
                    onClick={() => handleToolbarAction("italic")}
                    disabled={isSending}
                  >
                    <em>I</em>
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-secondary"
                    onClick={() => handleToolbarAction("underline")}
                    disabled={isSending}
                  >
                    <span style={{ textDecoration: "underline" }}>U</span>
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-secondary"
                    onClick={() => handleToolbarAction("insertOrderedList")}
                    disabled={isSending}
                  >
                    OL
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-secondary"
                    onClick={() => handleToolbarAction("insertUnorderedList")}
                    disabled={isSending}
                  >
                    UL
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-secondary"
                    onClick={() => handleToolbarAction("createLink")}
                    disabled={isSending}
                  >
                    Link
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-secondary"
                    onClick={() => handleToolbarAction("removeFormat")}
                    disabled={isSending}
                  >
                    Clear
                  </button>
                </div>
                <div
                  className="form-control form-control-sm"
                  style={{
                    height: "280px",
                    overflowY: "auto",
                    textAlign: "left",
                  }}
                  contentEditable={!isSending}
                  suppressContentEditableWarning
                  onInput={handleContentInput}
                  ref={contentRef}
                />
              </div>
              <div className="col-12">
                <label className="form-label">CC</label>
                <div className="d-flex flex-column gap-2 w-50">
                  {ccEntries.map((entry, index) => (
                    <div key={`cc-${index}`} className="d-flex gap-2">
                      <input
                        type="email"
                        className="form-control form-control-sm"
                        placeholder="Email"
                        value={entry}
                        onChange={handleCcChange(index)}
                        disabled={isSending}
                      />
                      {ccEntries.length > 1 && (
                        <button
                          type="button"
                          className="btn btn-outline-secondary"
                          onClick={() => handleRemoveCc(index)}
                          disabled={isSending}
                          aria-label="Remove CC"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    className="btn btn-link btn-sm p-0 text-decoration-none"
                    onClick={handleAddCc}
                    disabled={isSending}
                  >
                    + Add New
                  </button>
                </div>
              </div>
            </form>
          </div>
          <div className="modal-footer">
            <button
              type="button"
              className="btn btn-outline-secondary"
              onClick={onClose}
              disabled={isSending}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={onSend}
              disabled={isSending}
            >
              {isSending ? "Sending..." : "Send Email"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PaymentRequestEmailModal;
