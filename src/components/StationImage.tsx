import React, { useEffect, useState } from "react";
import { Fuel } from "lucide-react";

interface StationImageProps {
  src: string;
  alt: string;
  className?: string;
  fallbackTitle?: string;
}

export const StationImage: React.FC<StationImageProps> = ({
  src,
  alt,
  className = "w-full h-full object-cover",
  fallbackTitle = "محطة فنار الطاقة للوقود",
}) => {
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setHasError(false);
  }, [src]);

  if (hasError) {
    return (
      <div
        role="img"
        aria-label={alt}
        className="w-full h-full bg-gradient-to-br from-[#1B2E66] via-[#152554] to-[#961B5E] flex flex-col items-center justify-center p-4 text-center text-white"
      >
        <Fuel className="w-7 h-7 text-sky-300 mb-2 shrink-0" />
        <span className="text-xs font-semibold leading-snug">{fallbackTitle}</span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setHasError(true)}
      className={className}
    />
  );
};
