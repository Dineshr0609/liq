import { createContext, useContext, useState, ReactNode, useCallback } from "react";

type UploadModalContextValue = {
  isOpen: boolean;
  open: () => void;
  close: () => void;
};

const UploadModalContext = createContext<UploadModalContextValue | null>(null);

export function UploadModalProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);

  return (
    <UploadModalContext.Provider value={{ isOpen, open, close }}>
      {children}
    </UploadModalContext.Provider>
  );
}

export function useUploadModal() {
  const ctx = useContext(UploadModalContext);
  if (!ctx) {
    throw new Error("useUploadModal must be used within UploadModalProvider");
  }
  return ctx;
}
