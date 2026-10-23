import React, { useEffect } from "react";
 
export const SoftFlowCursor: React.FC = () => {
  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.classList.remove("has-soft-cursor");
    }
  }, []);

  return null;
};

