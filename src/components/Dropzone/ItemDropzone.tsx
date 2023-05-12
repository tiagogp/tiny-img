import React, { FC, useEffect } from "react";
import { motion } from "framer-motion";
import { convertSizeFileAndUnit } from "@/utils/convertSizeFileAndUnit";
import imageCompression from "browser-image-compression";

interface ItemDropzoneProps {
  index: number;
  file: File;
  updateSelectedFiles(
    index: number,
    newValues: {
      newFile: File;
    }
  ): void;
  deleteFile(index: number): void;
}

export const ItemDropzone: FC<ItemDropzoneProps> = ({
  file,
  index,
  updateSelectedFiles,
}) => {
  const [isLoaded, setIsLoaded] = React.useState(false);
  const [newFile, setNewFile] = React.useState<File | null>(null);

  const { name, size } = file;
  const handleDownload = async () => {
    if (newFile) {
      console.log(newFile);
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

  useEffect(() => {
    (async () => {
      setIsLoaded(true);
      const compressedFiles = await imageCompression(file, {
        maxSizeMB: 50,
        maxWidthOrHeight: 1920,
      });
      setIsLoaded(false);

      setNewFile(compressedFiles);

      updateSelectedFiles(index, {
        newFile: compressedFiles,
      });
    })();
  }, []);

  return (
    <motion.div
      initial={{
        opacity: 0,
        height: 0,
      }}
      animate={{
        opacity: 1,
        height: 48,
      }}
      transition={{
        duration: 0.5,
        delay: 0.05 * index,
        type: "spring",
        bounce: 0,
      }}
      key={`${name}-${index}`}
      className="text-slate-400 text-sm flex flex-wrap items-center justify-between w-full border-b py-4 last-of-type:border-b-0 border-slate-100"
    >
      <p className="w-[15rem] truncate">{name}</p>
      <div className="flex items-center gap-4 justify-start bg-slate-50">
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
      {isLoaded && (
        <div className="flex items-center">
          <div className="w-4 h-4 rounded-full bg-slate-400 animate-pulse mr-2"></div>
          <p>Compressing...</p>
        </div>
      )}
      {newFile && (
        <div className="flex items-center gap-4">
          <button
            onClick={handleDownload}
            className="text-blue-400 hover:text-blue-500"
          >
            Download
          </button>
        </div>
      )}
    </motion.div>
  );
};
