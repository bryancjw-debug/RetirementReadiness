import { useState } from "react";
import { Download } from "lucide-react";
import type { ExportData } from "../utils/excelExport";

export function ExcelDownload(data: ExportData) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  return <div className="excel-download"><button type="button" className="secondary-action" disabled={busy} onClick={async () => {
    setBusy(true); setMessage("");
    try { const { downloadProjectionWorkbook } = await import("../utils/excelExport"); await downloadProjectionWorkbook(data); setMessage("Excel file prepared. Check your browser downloads."); }
    catch { setMessage("The Excel download could not be prepared. Please try again."); }
    finally { setBusy(false); }
  }}><Download size={18} /> {busy ? "Preparing Excel…" : "Download Excel"}</button><small>Full projection and assumptions · SGD · Generated on your device</small><span role="status">{message}</span></div>;
}
