"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import React, { DragEvent, useCallback, useMemo, useState } from "react";
import { verifyFile } from "../../utils/verifyFile";
import ItemDropzone from "./ItemDropzone";
import useMediaQuery from "@/hooks/useMediaQuery";
import JSZip from "jszip";
import { Spinner } from "../Spinner";
import { Counter } from "../Counter";

export const Dropzone = () => {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [newFiles, setNewFiles] = useState<File[]>([]);

  const matches = useMediaQuery("(max-width: 480px)");

  const clearFiles = useCallback(() => {
    setSelectedFiles([]);
    setNewFiles([]);
  }, []);

  const handleFileSelect = (event: any) => {
    const files = Array.from(event.target.files as File[]).filter((item) =>
      verifyFile(item as File)
    );

    setSelectedFiles([...selectedFiles, ...files.slice(0, 30)]);
  };

  const handleFileDrop = (event: DragEvent<HTMLElement>) => {
    setIsDragging(false);

    const files = Object.values(event.dataTransfer.files).filter((item) =>
      verifyFile(item as File)
    );

    setSelectedFiles([...selectedFiles, ...files.slice(0, 30)]);
  };

  const handleDownload = async () => {
    const zip = new JSZip();

    await Promise.all(
      newFiles.map(async (file, index) => {
        zip.file(`${file.name}-${index}.jpg`, file);
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

  const updateNewFiles = useCallback((file: File) => {
    setNewFiles((prev) => {
      const oldValueIndex = prev.findIndex((item) => item.name === file.name);
      if (oldValueIndex !== -1) {
        prev.splice(oldValueIndex, 1);
        return prev;
      }

      return [...prev, file];
    });
  }, []);

  const reduceNewFilesValue = newFiles.reduce((acc, cur) => acc + cur.size, 0);

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
          Up to 30 image, max 100 MB each.
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
            setNewFiles={updateNewFiles}
          />
        ))}
      </motion.div>
      {selectedFiles.length === newFiles.length && (
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
              newFiles.length !== selectedFiles.length
            }
          >
            {selectedFiles.length === 0 ||
              (newFiles.length !== selectedFiles.length && (
                <Spinner className="mr-1" />
              ))}
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
              newFiles.length !== selectedFiles.length
            }
          >
            {selectedFiles.length === 0 ||
              (newFiles.length !== selectedFiles.length && <Spinner />)}
            Clear All
          </motion.button>
        </div>
      )}
    </>
  );
};
