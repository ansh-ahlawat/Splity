import React, { useState } from 'react';
import { UploadCloud, Sparkles, Check, CheckCircle2, XCircle, Receipt, ArrowRight, X } from 'lucide-react';
import { apiRequest } from '../api/httpClient.js';
import { ImportJob, ImportItem } from '../types.js';
import { ModalContainer } from './ModalContainer.js';

interface ImportStatementModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const ImportStatementModal: React.FC<ImportStatementModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [importJob, setImportJob] = useState<ImportJob | null>(null);
  const [items, setItems] = useState<ImportItem[]>([]);
  const [committing, setCommitting] = useState(false);
  const [sampleText, setSampleText] = useState('');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      if (selectedFile.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = () => {
          if (typeof reader.result === 'string') {
            setImageBase64(reader.result);
          }
        };
        reader.readAsDataURL(selectedFile);
      } else {
        setImageBase64(null);
      }
    }
  };

  const handleClearFile = () => {
    setFile(null);
    setImageBase64(null);
  };

  const handleInsertSampleText = () => {
    setSampleText(
      "08/02/2026 GROCERY WHOLE FOODS ₹1450.00 EXPENSE\n08/04/2026 FUEL SHELL STATION ₹420.00 EXPENSE\n08/06/2026 SALARY DIRECT DEPOSIT ₹75000.00 INCOME\n08/08/2026 AMAZON ELECTRONICS ₹2190.00 EXPENSE"
    );
  };

  const handleStartUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file && !sampleText.trim()) {
      alert('Please upload a statement/receipt file or paste statement text.');
      return;
    }

    setUploading(true);
    try {
      const fileName = file ? file.name : 'statement_raw_text.txt';
      const fileType = fileName.endsWith('.pdf') ? 'PDF' : 'IMAGE';

      const createRes = await apiRequest<{ importJob: ImportJob; uploadUrl: string }>('/api/imports', {
        method: 'POST',
        body: JSON.stringify({ fileName, fileType }),
      });

      const processRes = await apiRequest<ImportJob>(`/api/imports/${createRes.importJob.id}/process`, {
        method: 'POST',
        body: JSON.stringify({
          textContent: sampleText.trim() ? sampleText.trim() : undefined,
          imageBase64: imageBase64 || undefined,
        }),
      });

      setImportJob(processRes);
      setItems(processRes.items || []);
    } catch (err: any) {
      alert(err.message || 'Import processing failed');
    } finally {
      setUploading(false);
    }
  };

  const handleToggleItemStatus = async (item: ImportItem, newStatus: 'ACCEPTED' | 'REJECTED') => {
    if (!importJob) return;
    try {
      const updated = await apiRequest<ImportItem>(`/api/imports/${importJob.id}/items/${item.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus }),
      });
      setItems((prev) => prev.map((i) => (i.id === item.id ? updated : i)));
    } catch (err: any) {
      alert(err.message || 'Failed to update item');
    }
  };

  const handleAcceptAll = () => {
    items.forEach((item) => {
      if (item.status !== 'ACCEPTED') {
        handleToggleItemStatus(item, 'ACCEPTED');
      }
    });
  };

  const handleCommit = async () => {
    if (!importJob) return;
    setCommitting(true);
    try {
      const res = await apiRequest<{ createdCount: number }>(`/api/imports/${importJob.id}/commit`, {
        method: 'POST',
      });
      alert(`Successfully committed ${res.createdCount} transactions!`);
      window.dispatchEvent(new CustomEvent('splity:refresh'));
      onSuccess?.();
      onClose();
    } catch (err: any) {
      alert(err.message || 'Commit failed');
    } finally {
      setCommitting(false);
    }
  };

  return (
    <ModalContainer
      isOpen={isOpen}
      onClose={onClose}
      title="Import Bank Statement"
      subtitle="Extract and categorize candidate records automatically"
      badge={
        <span className="text-[11px] font-semibold bg-[rgba(22,101,52,0.08)] text-[#166534] px-2.5 py-0.5 rounded-full border border-[rgba(22,101,52,0.14)]">
          AI Parser
        </span>
      }
      maxWidthClass="max-w-3xl"
      maxHeightClass="max-h-[88vh] sm:max-h-[590px]"
    >
      <div className="space-y-6">
        {!importJob ? (
          <form onSubmit={handleStartUpload} className="space-y-4">
            <div className="border border-dashed border-gray-200 hover:border-green-600 rounded-3xl p-6 sm:p-7 text-center transition-all bg-gray-50/50 relative">
              {file ? (
                <div className="flex flex-col items-center">
                  <div className="w-14 h-14 rounded-2xl bg-green-100/70 border border-green-200 flex items-center justify-center text-green-700 mb-2 overflow-hidden shadow-xs">
                    {imageBase64 ? (
                      <img
                        src={imageBase64}
                        alt="Receipt preview"
                        className="w-full h-full object-cover rounded-2xl"
                      />
                    ) : (
                      <UploadCloud className="w-6 h-6 text-green-700" />
                    )}
                  </div>
                  <p className="text-sm font-semibold text-gray-900 truncate max-w-[320px]">
                    {file.name}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5 font-light">
                    {(file.size / 1024).toFixed(1)} KB &bull; {imageBase64 ? 'Ready for OCR parsing' : 'Statement file'}
                  </p>
                  <button
                    type="button"
                    onClick={handleClearFile}
                    className="mt-3 inline-flex items-center gap-1 text-xs text-red-500 hover:text-red-700 font-medium py-1 px-3 rounded-full hover:bg-red-50 transition-colors cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" /> Remove file
                  </button>
                </div>
              ) : (
                <>
                  <UploadCloud className="w-10 h-10 text-green-700 mx-auto mb-3" />
                  <p className="text-sm font-semibold text-gray-900">
                    Upload PDF statement or receipt image
                  </p>
                  <p className="text-xs text-gray-400 mt-1 font-light">
                    PDF, PNG, JPEG up to 10MB
                  </p>
                  <input
                    type="file"
                    accept=".pdf,image/*"
                    onChange={handleFileChange}
                    className="hidden"
                    id="modal-statement-file-input"
                  />
                  <label
                    htmlFor="modal-statement-file-input"
                    className="mt-4 inline-block btn-secondary cursor-pointer text-xs"
                  >
                    Browse Files
                  </label>
                </>
              )}
            </div>

            <div className="pt-2.5 mt-1 space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-gray-700 block">
                  Or Paste Statement Lines / Raw Text
                </label>
                {!sampleText ? (
                  <button
                    type="button"
                    onClick={handleInsertSampleText}
                    className="text-[11px] text-green-700 hover:text-green-800 font-medium hover:underline cursor-pointer"
                  >
                    + Load Example Lines
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setSampleText('')}
                    className="text-[11px] text-gray-400 hover:text-red-500 font-medium hover:underline cursor-pointer"
                  >
                    Clear Text
                  </button>
                )}
              </div>
              <textarea
                rows={3}
                value={sampleText}
                onChange={(e) => setSampleText(e.target.value)}
                className="input-base w-full min-h-[96px] pt-4 px-3 pb-3 font-mono-num text-xs font-light resize-none leading-relaxed"
                placeholder={"05/09/2025  Swiggy Instamart      ₹347.00\n06/09/2025  Amazon Pay UPI        ₹1,299.00\n06/09/2025  Zomato Gold           ₹149.00"}
              />
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="btn-secondary text-xs px-4"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={uploading}
                className="btn-primary text-xs flex items-center gap-2 px-5 hover:transform-none"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>{uploading ? 'Processing AI...' : 'Parse & Extract Transactions'}</span>
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-gray-100">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">
                  Extracted Records ({items.length})
                </h3>
                <p className="text-xs text-gray-400 font-light">
                  Review extracted line items before committing to ledger
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setImportJob(null);
                    setItems([]);
                  }}
                  className="btn-secondary text-xs px-3 py-1.5"
                >
                  New Upload
                </button>
                {items.length > 0 && (
                  <>
                    <button
                      type="button"
                      onClick={handleAcceptAll}
                      className="btn-secondary text-xs px-3 py-1.5"
                    >
                      Accept All
                    </button>
                    <button
                      type="button"
                      onClick={handleCommit}
                      disabled={committing || items.filter((i) => i.status === 'ACCEPTED').length === 0}
                      className="btn-primary text-xs px-4 py-1.5 flex items-center gap-1.5 hover:transform-none"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>
                        {committing
                          ? 'Committing...'
                          : `Commit (${items.filter((i) => i.status === 'ACCEPTED').length})`}
                      </span>
                    </button>
                  </>
                )}
              </div>
            </div>

            {items.length === 0 ? (
              <div className="p-8 text-center bg-gray-50/60 rounded-3xl border border-gray-100 space-y-3">
                <p className="text-sm font-medium text-gray-700">No transaction records found in the provided input.</p>
                <p className="text-xs text-gray-400 font-light max-w-md mx-auto">
                  Try uploading a clearer image or paste statement text lines with date, merchant, and rupee amounts.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setImportJob(null);
                    setItems([]);
                  }}
                  className="btn-secondary text-xs px-4 py-2 mt-2 cursor-pointer"
                >
                  Try Another File / Text
                </button>
              </div>
            ) : (
              <div className="max-h-60 overflow-y-auto space-y-2 pr-0.5">
              {items.map((item) => {
                const isAccepted = item.status === 'ACCEPTED';
                const isRejected = item.status === 'REJECTED';
                return (
                  <div
                    key={item.id}
                    className={`p-3 rounded-2xl border transition-all flex items-center justify-between ${
                      isAccepted
                        ? 'bg-green-50/70 border-green-200 text-green-950'
                        : isRejected
                        ? 'bg-gray-50/60 border-gray-200 text-gray-400 opacity-60'
                        : 'bg-white border-[#edf2ee] text-gray-800'
                    }`}
                  >
                    <div className="min-w-0 pr-2">
                      <div className="text-xs font-medium truncate">{item.rawText}</div>
                      <div className="text-[11px] font-mono-num text-gray-400 font-light mt-0.5">
                        ₹{item.amount?.toLocaleString('en-IN')} &bull; {item.date} &bull; {item.type}
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleToggleItemStatus(item, 'ACCEPTED')}
                        className={`p-1.5 rounded-full transition-colors ${
                          isAccepted
                            ? 'bg-green-700 text-white'
                            : 'text-gray-400 hover:text-green-700 hover:bg-green-50'
                        }`}
                        title="Accept"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleToggleItemStatus(item, 'REJECTED')}
                        className={`p-1.5 rounded-full transition-colors ${
                          isRejected
                            ? 'bg-red-600 text-white'
                            : 'text-gray-400 hover:text-red-600 hover:bg-red-50'
                        }`}
                        title="Reject"
                      >
                        <XCircle className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
              </div>
            )}
          </div>
        )}
      </div>
    </ModalContainer>
  );
};
