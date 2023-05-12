import React, { FC, memo, useMemo } from "react";
import { motion } from "framer-motion";
import { convertSizeFileAndUnit } from "@/utils/convertSizeFileAndUnit";
import imageCompression from "browser-image-compression";

interface ItemDropzoneProps {
  index: number;
  file: File;
  deleteFile(index: number): void;
  isMobile: boolean;
  setNewFiles(files: File): void;
}

const ItemDropzone: FC<ItemDropzoneProps> = ({
  file,
  index,
  isMobile,
  setNewFiles,
}) => {
  const [newFile, setNewFile] = React.useState<File | null>(null);

  const { name, size } = file;
  const handleDownload = async () => {
    if (newFile) {
      const { name, type } = newFile;
      const downloadLink = document.createElement("a");
      downloadLink.href = URL.createObjectURL(newFile);
      downloadLink.download = `tinyimg-${name.replace(
        `.${type.split("/")[1]}`,
        ""
      )}-${index}.jpg`;
      downloadLink.click();
    }
  };

  useMemo(() => {
    const time = setTimeout(() => {
      (async () => {
        const compressedFiles = await imageCompression(file, {
          maxSizeMB: file.size / 1000000,
          maxWidthOrHeight: 1920,
        });

        setNewFiles(compressedFiles);
        setNewFile(compressedFiles);
      })();
    }, 700 + (100 * index + 1));

    return () => {
      clearTimeout(time);
    };
  }, []);

  return (
    <motion.div
      initial={{
        opacity: 0,
        height: 0,
      }}
      animate={{
        opacity: 1,
        height: isMobile ? 78 : 56,
      }}
      transition={{
        duration: 0.5,
        delay: 0.05 * index,
        type: "spring",
        bounce: 0,
      }}
      key={`${name}-${index}`}
      className="text-slate-400 text-sm flex flex-wrap items-center justify-between w-full border-b py-4 last-of-type:border-b-0 border-slate-100 h-24 sm:h-14 gap-y-2"
    >
      <p className="w-[10rem] truncate ">
        {index + 1}. {name}
      </p>
      <div className="flex items-center gap-4 justify-start ">
        <p
          className={`${
            newFile && "line-through text-xs opacity-50"
          } transition-all duration-500 ease-in-out`}
        >
          {convertSizeFileAndUnit(size)}
        </p>
        {newFile && (
          <>
            {">"}
            <p className="text-green-400 text-xs">
              {convertSizeFileAndUnit(newFile.size)}
            </p>
          </>
        )}
      </div>
      {!newFile && (
        <div className="flex items-center">
          <div className="w-4 h-4 rounded-full bg-slate-400 animate-pulse mr-2"></div>
          <p>Compressing...</p>
        </div>
      )}
      {newFile && (
        <div className="flex items-center gap-4">
          <button
            onClick={handleDownload}
            className="text-blue-400 hover:text-blue-500 py-1 px-2 rounded-md border border-blue-400 hover:border-blue-500 hover:bg-blue-100 transition-all duration-200 ease-in-out text-xs"
          >
            Download
          </button>
        </div>
      )}
    </motion.div>
  );
};

export default memo(ItemDropzone);
