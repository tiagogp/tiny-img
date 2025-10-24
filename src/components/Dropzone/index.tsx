"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import React, {
  DragEvent,
  useCallback,
  useMemo,
  useState,
  useEffect,
} from "react";
import { verifyFile } from "../../utils/verifyFile";
import ItemDropzone from "./ItemDropzone";
import useMediaQuery from "@/hooks/useMediaQuery";
import JSZip from "jszip";
import { Counter } from "../Counter";
import imageCompression from "browser-image-compression";

function getFileDimensions(
  file: File
): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => {
      resolve({ width: img.width, height: img.height });
    };
    img.onerror = () => {
      reject(new Error("Failed to load the image file."));
    };
    img.src = URL.createObjectURL(file);
  });
}

export const Dropzone = () => {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const [processingFiles, setProcessingFiles] = useState<Set<number>>(
    new Set()
  );
  const [isProcessing, setIsProcessing] = useState(false);

  const matches = useMediaQuery("(max-width: 480px)");

  const clearFiles = useCallback(() => {
    setSelectedFiles([]);
    setNewFiles([]);
    setProcessingFiles(new Set());
    setIsProcessing(false);
  }, []);

  const processFilesInChunks = useCallback(async (files: File[]) => {
    if (files.length === 0) return;

    setIsProcessing(true);
    const chunkSize = 4;
    const chunks = [];

    for (let i = 0; i < files.length; i += chunkSize) {
      chunks.push(files.slice(i, i + chunkSize));
    }

    for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
      const chunk = chunks[chunkIndex];

      const chunkIndices = chunk.map(
        (_, index) => chunkIndex * chunkSize + index
      );
      setProcessingFiles(new Set(chunkIndices));

      const processedFiles = await Promise.all(
        chunk.map(async (file, index) => {
          const globalIndex = chunkIndex * chunkSize + index;
          try {
            const result = await getFileDimensions(file);
            const minorDimension = Math.min(result.width, result.height);

            const compressedFile = await imageCompression(file, {
              maxWidthOrHeight: minorDimension < 1080 ? minorDimension : 1080,
              alwaysKeepResolution: true,
            });

            return { file: compressedFile, index: globalIndex };
          } catch (error) {
            console.error(`Error processing file ${file.name}:`, error);
            return { file: null, index: globalIndex };
          }
        })
      );

      processedFiles.forEach(({ file, index }) => {
        if (file) {
          setNewFiles((prev) => {
            const newArray = [...prev];
            newArray[index] = file;
            return newArray;
          });
        }
      });

      setProcessingFiles((prev) => {
        const newSet = new Set(prev);
        chunkIndices.forEach((index) => newSet.delete(index));
        return newSet;
      });

      if (chunkIndex < chunks.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    setIsProcessing(false);
  }, []);

  useEffect(() => {
    if (selectedFiles.length > 0 && newFiles.length === 0) {
      setNewFiles(new Array(selectedFiles.length).fill(undefined));
      processFilesInChunks(selectedFiles);
    }
  }, [selectedFiles, processFilesInChunks]);

  const handleFileSelect = (event: any) => {
    const files = Array.from(event.target.files as File[]).filter((item) =>
      verifyFile(item as File)
    );

    setSelectedFiles([...selectedFiles, ...files]);
  };

  const handleFileDrop = (event: DragEvent<HTMLElement>) => {
    setIsDragging(false);

    const files = Object.values(event.dataTransfer.files).filter((item) =>
      verifyFile(item as File)
    );

    setSelectedFiles([...selectedFiles, ...files]);
  };

  const handleDownload = async () => {
    const zip = new JSZip();

    await Promise.all(
      newFiles
        .filter((f) => f !== undefined)
        .map(async (file) => {
          zip.file(file.name, file);
        })
    );

    const zipBlob = await zip.generateAsync({ type: "blob" });
    const downloadLink = document.createElement("a");
    downloadLink.href = URL.createObjectURL(zipBlob);
    downloadLink.download = "tinyimg.zip";
    downloadLink.click();
  };

  const dragEnter = (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    setIsDragging(true);
  };

  const dragLeave = (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    setIsDragging(false);
  };

  const onDropCapture = (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    setIsDragging(false);
  };

  const deleteFile = (index: number) => {
    const newSelectedFiles = [...selectedFiles];
    newSelectedFiles.splice(index, 1);

    setSelectedFiles(newSelectedFiles);
  };

  const updateNewFiles = useCallback((file: File, index: number) => {
    setNewFiles((prev) => {
      const newArray = [...prev];
      newArray[index] = file;
      return newArray;
    });
  }, []);

  const reduceNewFilesValue = newFiles
    .filter((f) => f !== undefined)
    .reduce((acc, cur) => acc + cur.size, 0);

  const reduceSelectedFilesValue = selectedFiles.reduce(
    (acc, cur) => acc + cur.size,
    0
  );

  const reduceTotalValue = useMemo(() => {
    if (reduceSelectedFilesValue === 0 || reduceNewFilesValue === 0) {
      return 0;
    }

    return 100 - (reduceNewFilesValue / reduceSelectedFilesValue) * 100;
  }, [reduceNewFilesValue, reduceSelectedFilesValue]);

  return (
    <>
      <main
        onDropCapture={onDropCapture}
        onDragEnter={dragEnter}
        onDragLeave={dragLeave}
        onDrop={handleFileDrop}
        onDragOver={(event) => event.preventDefault()}
        className={`relative transition-all duration-300 select-none flex flex-col justify-center items-center w-11/12 max-w-screen-lg py-4 sm:h-80 border rounded border-dashed ${
          isDragging
            ? "border-blue-400 bg-blue-100"
            : "border-slate-400 bg-slate-100"
        }`}
      >
        <Image
          src="/upload.svg"
          alt="upload"
          width={100}
          height={100}
          className="h-20 w-20 md:w-auto md:h-auto"
          priority
        />

        <input
          aria-label="file-input"
          onChange={(e) => handleFileSelect(e)}
          type="file"
          multiple
          className="opacity-0 z-0 w-full h-full absolute cursor-pointer"
          itemType="image/png"
          name="file"
        />
        <h3 className="font-semibold text-gray-800 text-sm md:text-base mt-5 text-center w-11/12">
          Drop your WebP, PNG or JPEG files here!
        </h3>
        <p className="text-gray-600 text-xs md:text-sm mt-1">
          Up to 100 image, max 100 MB each.
        </p>
      </main>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{
          opacity: selectedFiles.length > 0 ? 1 : 0,
        }}
        transition={{ duration: 1, type: "spring", bounce: 0 }}
        className={`transition-all flex flex-col  w-11/12 max-w-screen-lg mt-5 border rounded px-4 max-h-[200px] xs:max-h-[300px] overflow-auto relative bg-white z-10`}
      >
        {selectedFiles.map((item, index) => (
          <ItemDropzone
            index={index}
            key={`${item.name}-${index}`}
            file={item}
            deleteFile={deleteFile}
            isMobile={matches}
            actualItem={newFiles[index]}
            isProcessing={processingFiles.has(index)}
          />
        ))}
      </motion.div>

      {selectedFiles.length > 0 &&
        newFiles.filter((f) => f !== undefined).length ===
          selectedFiles.length && (
          <motion.div
            initial={{
              opacity: 0,
              height: 0,
            }}
            animate={{
              opacity: reduceTotalValue > 0 ? 1 : 0,
              height: reduceTotalValue > 0 ? 48 : 0,
            }}
            transition={{
              duration: 0.5,
              type: "spring",
              bounce: 0,
            }}
            className="flex items-center justify-center gap-2  px-4 bg-gray-100 w-11/12 max-w-screen-lg rounded-b -mt-1"
          >
            <p className="text-slate-400 text-xs md:text-sm">
              Tinyimg will reduce the size by
            </p>
            <div className="flex text-slate-700 font-bold text-sm md:text-sm">
              <Counter
                from={0}
                to={Number(reduceTotalValue.toFixed(2))}
                duration={1}
              />
              %
            </div>
          </motion.div>
        )}

      {selectedFiles.length > 0 &&
        newFiles.filter((f) => f !== undefined).length <=
          selectedFiles.length && (
          <div className="flex items-start w-11/12 max-w-screen-lg ">
            <motion.div
              initial={{
                opacity: 0,
                height: 0,
                width: 0,
              }}
              animate={{
                opacity: reduceTotalValue > 0 ? 1 : 0,
                height: reduceTotalValue > 0 ? 16 : 0,
                width: `${
                  (newFiles.filter((f) => f !== undefined).length /
                    selectedFiles.length) *
                  100
                }%`,
              }}
              transition={{
                duration: 0.5,
                type: "spring",
                bounce: 0,
              }}
              className="h-1 bg-blue-400 rounded-b-md -translate-y-1 -z-10"
            />
          </div>
        )}
      {selectedFiles.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          <motion.button
            initial={{ opacity: 0 }}
            animate={{
              opacity: selectedFiles.length > 0 ? 1 : 0,
            }}
            transition={{ duration: 0.5, type: "spring", bounce: 0 }}
            onClick={handleDownload}
            className={`disabled:bg-slate-200 disabled:text-gray-400 transition-all mt-3 flex items-center justify-center rounded font-medium py-2 px-6 bg-black hover:bg-black/90 text-white active:scale-[.97] active:translate-y-0.5
            `}
            disabled={
              selectedFiles.length === 0 ||
              newFiles.filter((f) => f !== undefined).length !==
                selectedFiles.length
            }
          >
            Download All
          </motion.button>
          <motion.button
            initial={{ opacity: 0 }}
            animate={{
              opacity: selectedFiles.length > 0 ? 1 : 0,
            }}
            transition={{ duration: 0.5, type: "spring", bounce: 0 }}
            onClick={clearFiles}
            className={`disabled:bg-slate-200 disabled:text-gray-400 transition-all mt-3 flex items-center justify-center rounded font-medium py-2 px-6 border-2 disabled:border-0 border-black active:scale-[.97] active:translate-y-0.5
            `}
            disabled={
              selectedFiles.length === 0 ||
              newFiles.filter((f) => f !== undefined).length !==
                selectedFiles.length
            }
          >
            Clear All
          </motion.button>
        </div>
      )}
    </>
  );
};
