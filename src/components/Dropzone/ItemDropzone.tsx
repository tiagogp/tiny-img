import React, { FC, memo, useEffect, useRef } from "react";
import { motion, useInView } from "framer-motion";
import { convertSizeFileAndUnit } from "@/utils/convertSizeFileAndUnit";
import imageCompression from "browser-image-compression";

interface ItemDropzoneProps {
  index: number;
  file: File;
  deleteFile(index: number): void;
  isMobile: boolean;
  setNewFiles: (file: File, index: number) => void;
  actualItem: File
}

function getFileDimensions(
  file: File
): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.width, height: img.height });
    };
    img.onerror = () => {
      reject(new Error("Failed to load the image file."));
    };
    img.src = URL.createObjectURL(file);
  });
}

const ItemDropzone: FC<ItemDropzoneProps> = ({
  file,
  index,
  isMobile,
  setNewFiles,
  actualItem
}) => {

  const { name, size } = file;
  const handleDownload = async () => {
    if (actualItem) {
      const { name, type } = actualItem;
      const downloadLink = document.createElement("a");
      downloadLink.href = URL.createObjectURL(actualItem);
      downloadLink.download = `tinyimg-${name.replace(
        `.${type.split("/")[1]}`,
        ""
      )}-${index}.jpg`;
      downloadLink.click();
    }
  };

  useEffect(() => {
    const time = setTimeout(() => {
      (async () => {
        const result = await getFileDimensions(file);

        const minorDimension = Math.min(result.width, result.height);

        const compressedFiles = await imageCompression(file, {
          maxWidthOrHeight: minorDimension < 1080 ? minorDimension : 1080,
          alwaysKeepResolution: true
        });

        setNewFiles(compressedFiles, index);
      })();
    }, (index * 70));

    return () => {
      clearTimeout(time);
    };
  }, [file, index, setNewFiles]);

  return (
    <div
      className="text-slate-400 text-sm flex flex-wrap items-center justify-between w-full border-b py-4 last-of-type:border-b-0 border-slate-100 h-24 sm:h-14 gap-y-2"
    >
      <p className="w-[10rem] truncate ">
        {index + 1}. {name}
      </p>
      <div className="flex items-center gap-4 justify-start ">
        <p
          className={`${actualItem && "line-through text-xs opacity-50"
            } transition-all duration-500 ease-in-out`}
        >
          {convertSizeFileAndUnit(size)}
        </p>
        {actualItem && (
          <>
            {">"}
            <p className="text-green-400 text-xs">
              {convertSizeFileAndUnit(actualItem.size)}
            </p>
          </>
        )}
      </div>
      {!actualItem && (
        <div className="flex items-center">
          <div className="w-4 h-4 rounded-full bg-slate-400 animate-pulse mr-2"></div>
          <p>Compressing...</p>
        </div>
      )}
      {actualItem && (
        <div className="flex items-center gap-4">
          <button
            onClick={handleDownload}
            className="text-blue-400 hover:text-blue-500 py-1 px-2 rounded-md border border-blue-400 hover:border-blue-500 hover:bg-blue-100 transition-all duration-200 ease-in-out text-xs"
          >
            Download
          </button>
        </div>
      )}
    </div>
  );
};

export default ItemDropzone;
